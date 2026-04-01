/**
 * useSignPdf.ts
 * ─────────────
 * React hook that handles the full PDF-signing flow against the Flask
 * pnpki_local.py server.
 *
 * Usage (inside your SignDocument component):
 *
 *   const { signing, signError, signPdf } = useSignPdf();
 *
 *   // When the user confirms the stamp position:
 *   await signPdf({
 *     pdfBlob,          // the PDF File / Blob to sign
 *     sigX, sigY,       // stamp position (PDF point coords, bottom-origin)
 *     boxW, boxH,       // stamp box size in PDF points
 *     pageWidth,        // PDF page width  in points
 *     pageHeight,       // PDF page height in points
 *     pageNumber,       // 1-based page number
 *     signAllPages,     // sign every page?
 *     onSuccess,        // (signedBlob: Blob, filename: string) => void
 *   });
 *
 * All stamp appearance settings (image, text, sizes, positions) are read
 * from localStorage via getStampOptsFromStorage().
 *
 * The hook sends the following fields to POST /sign-pdf:
 *   pdf_file      – the PDF to sign
 *   p12_file      – certificate (from localStorage sig_p12_data)
 *   password      – P12 passphrase  (from localStorage sig_password)
 *   signer_name   – display name    (from localStorage sig_displayName)
 *   sign_note     – position/title  (from localStorage sig_position)
 *   page          – page number
 *   sign_all_pages
 *   x_ratio / y_ratio / w_ratio / h_ratio  – stamp box as page fractions
 *   sign_design   – pre-rendered PNG blob (built by stampUtils)
 */

import { useState } from "react";
import {
  buildStampBlob,
  getStampOptsFromStorage,
  stampBoxToRatios,
} from "./stampUtils";

// ── configuration ─────────────────────────────────────────────────────────────

const SIGN_SERVER_URL =
  (import.meta as any).env?.VITE_SIGN_SERVER_URL ?? "http://localhost:5000";

// ── types ─────────────────────────────────────────────────────────────────────

export interface SignPdfParams {
  /** The PDF file or blob to sign */
  pdfBlob: Blob;
  /** Original filename (used for the download name) */
  pdfName?: string;

  /** Stamp box — PDF point coordinates, bottom-origin (same space as pdfjs viewport at scale 1) */
  sigX: number;   // left edge
  sigY: number;   // bottom edge
  boxW: number;   // width
  boxH: number;   // height

  /** PDF page dimensions in points (viewport at scale 1) */
  pageWidth:  number;
  pageHeight: number;

  /** 1-based page number */
  pageNumber: number;
  signAllPages: boolean;

  /** Called with the signed PDF blob and suggested filename on success */
  onSuccess: (blob: Blob, filename: string) => void;
}

export interface UseSignPdfReturn {
  signing:   boolean;
  signError: string | null;
  signPdf:   (params: SignPdfParams) => Promise<void>;
  clearError: () => void;
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useSignPdf(): UseSignPdfReturn {
  const [signing,   setSigning]   = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const clearError = () => setSignError(null);

  const signPdf = async (params: SignPdfParams): Promise<void> => {
    const {
      pdfBlob, pdfName = "document.pdf",
      sigX, sigY, boxW, boxH,
      pageWidth, pageHeight, pageNumber, signAllPages,
      onSuccess,
    } = params;

    setSigning(true);
    setSignError(null);

    try {
      // ── 1. Read stored credentials ───────────────────────────────────────
      const p12Base64 = localStorage.getItem("sig_p12_data");
      if (!p12Base64) {
        throw new Error(
          "No P12 certificate found. Please upload your certificate in Signature Settings."
        );
      }

      const password    = localStorage.getItem("sig_password")    ?? "";
      const signerName  = localStorage.getItem("sig_displayName") ?? "";
      const signNote    = localStorage.getItem("sig_position")    ?? "";

      // Convert base64 P12 → Blob
      const p12Bytes = Uint8Array.from(atob(p12Base64), c => c.charCodeAt(0));
      const p12Blob  = new Blob([p12Bytes], { type: "application/x-pkcs12" });

      // ── 2. Build stamp design PNG ────────────────────────────────────────
      const stampOpts = getStampOptsFromStorage();
      // Override stamp box size with the actual drawn box
      const designBlob = await buildStampBlob({
        ...stampOpts,
        stampWidthPt:  boxW,
        stampHeightPt: boxH,
        renderScale: 4,  // 4× → ~288 dpi for a 72 dpi PDF
      });

      // ── 3. Convert stamp position → page ratios ──────────────────────────
      const { x_ratio, y_ratio, w_ratio, h_ratio } = stampBoxToRatios(
        sigX, sigY, boxW, boxH, pageWidth, pageHeight
      );

      // ── 4. Build FormData ────────────────────────────────────────────────
      const form = new FormData();
      form.append("pdf_file",      pdfBlob,    pdfName);
      form.append("p12_file",      p12Blob,    "certificate.p12");
      form.append("password",      password);
      form.append("signer_name",   signerName);
      form.append("sign_note",     signNote);
      form.append("page",          String(pageNumber));
      form.append("sign_all_pages", signAllPages ? "true" : "false");
      form.append("x_ratio",       String(x_ratio));
      form.append("y_ratio",       String(y_ratio));
      form.append("w_ratio",       String(w_ratio));
      form.append("h_ratio",       String(h_ratio));
      // sign_design replaces any pyhanko-rendered text — it is the sole visual
      form.append("sign_design",   designBlob, "stamp.png");

      // ── 5. POST to Flask server ──────────────────────────────────────────
      const response = await fetch(`${SIGN_SERVER_URL}/sign-pdf`, {
        method: "POST",
        body:   form,
      });

      if (!response.ok) {
        const msg = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(msg || `Server returned ${response.status}`);
      }

      // ── 6. Return signed PDF ─────────────────────────────────────────────
      const signedBlob = await response.blob();
      const stem       = pdfName.replace(/\.pdf$/i, "");
      const filename   = `${stem}-signed.pdf`;
      onSuccess(signedBlob, filename);

    } catch (err: any) {
      setSignError(err?.message ?? "Signing failed. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  return { signing, signError, signPdf, clearError };
}

// ── convenience: trigger browser download ────────────────────────────────────

/**
 * Trigger a browser download for a signed PDF blob.
 * Call this inside the onSuccess callback of signPdf.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}