import { useEffect, useState, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).href;
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText, CheckCircle2, Key, Upload, AlertTriangle, Download,
  Eye, MousePointer2, Settings2, Loader2, ChevronDown, ChevronUp, XCircle, ShieldOff,
  ChevronLeft, ChevronRight, PenLine, Printer
} from "lucide-react";
import UserLayout from "./UserLayout";
import { documentApi, signatoryApi, Document, DocumentSignatory, DocumentFile } from "../../services/api";
import { useAuth } from "../Auth/AuthContext";
import DocumentFileList from "../../components/DocumentFileList";

/** Safely parse a datetime string from the API as UTC.
 *  If the string has no timezone suffix (no Z / +HH:MM) we append 'Z'
 *  so JavaScript doesn't misinterpret it as local time. */
const parseUTC = (str: string): Date =>
  new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(str) ? str : str + "Z");

/** Format a signed_at string for display */
const fmtSignedAt = (str: string) =>
  parseUTC(str).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// A4 fallback dimensions — actual values come from the PDF page
const PDF_W = 595, PDF_H = 842;

/** Convert base64 string (no data-URL prefix) into a File */
const base64ToFile = (b64: string, filename: string, mime: string): File => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};

/** Read a File as a base64 string (no prefix) */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const PNPKI_URL = (import.meta.env.VITE_PNPKI_SERVER as string || "").replace(/\/$/, "");
const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string || "").replace(/\/$/, "");

const SignDocument = () => {
  const { tracknumber } = useParams<{ tracknumber: string }>();
  const navigate        = useNavigate();
  const { user }        = useAuth();

  const [doc, setDoc]            = useState<Document | null>(null);
  const [loading, setLoading]    = useState(true);
  const [signing, setSigning]    = useState(false);
  const [done, setDone]          = useState(false);
  const [error, setError]        = useState<string | null>(null);
  const [signedBlobs, setSignedBlobs] = useState<Array<{ blob: Blob; name: string }>>([]);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);

  // ── Per-file stamp tracking ────────────────────────────────────────────────
  type FileStampConfig = {
    sigX: number; sigY: number; sigPage: number;
    sigBoxW: number; sigBoxH: number;
    placed: boolean; pdfW: number; pdfH: number;
  };
  const fileStampRef   = useRef<Record<number, FileStampConfig>>({});
  const [fileStampsState, setFileStampsState] = useState<Record<number, FileStampConfig>>({});
  const [activeDocFile, setActiveDocFile]     = useState<DocumentFile | null>(null);
  // Per-file manual-sign uploads: key = DocumentFile.id
  const [manualSignedFiles, setManualSignedFiles] = useState<Record<number, File>>({});

  // ----- UI tabs -----
  const [pdfVisible, setPdfVisible]       = useState(true);
  const [credOpen, setCredOpen]           = useState(false);

  // ----- Live placement overlay -----
  const [placingMode, setPlacingMode]  = useState(false);
  const [hoverPx, setHoverPx]          = useState<{left:number;top:number} | null>(null);
  const [stampPlaced, setStampPlaced]  = useState(false);

  // Drag-to-move / drag-to-resize refs for the confirmed stamp box
  const draggingStamp = useRef<{ startX:number; startY:number; origX:number; origY:number } | null>(null);
  const resizingStamp = useRef<{ startX:number; startY:number; origW:number; origH:number; origY:number } | null>(null);

  // ----- Canvas PDF viewer -----
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc]               = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl]       = useState<string | null>(null);
  const [pdfLoading, setPdfLoading]       = useState(false);
  const [pdfError, setPdfError]           = useState<string | null>(null);
  // renderScale = CSS px per 1 PDF user-space point (exact, from canvas rendering)
  const [renderScale, setRenderScale]     = useState(1);
  const [pdfPageWidth,  setPdfPageWidth]  = useState(PDF_W);
  const [pdfPageHeight, setPdfPageHeight] = useState(PDF_H);

  /** Render a single page to the canvas at container-fill scale */
  const renderPage = useCallback(async (doc: any, pageNum: number) => {
    if (!canvasRef.current || !viewerContainerRef.current) return;
    // Cancel any in-progress render before starting a new one
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch (_) { /* RenderingCancelledException — expected */ }
      renderTaskRef.current = null;
    }
    const page  = await doc.getPage(pageNum);
    const vp1   = page.getViewport({ scale: 1 });
    const cw    = viewerContainerRef.current.clientWidth || 600;
    const scale = cw / vp1.width;
    const vp    = page.getViewport({ scale });
    const canvas = canvasRef.current;
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const task = page.render({ canvasContext: ctx, viewport: vp });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err: any) {
      if (err?.name === "RenderingCancelledException") return;
      throw err;
    }
    renderTaskRef.current = null;
    setRenderScale(scale);
    setPdfPageWidth(vp1.width);
    setPdfPageHeight(vp1.height);
  }, []);

  const loadPdf = useCallback(async (fileUrl: string, opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    if (pdfBlobUrl && !force) return; // already loaded
    setPdfLoading(true);
    setPdfError(null);
    try {
      if (force && pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      const token = localStorage.getItem("auth_token");
      const requestUrl = force
        ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}_ts=${Date.now()}`
        : fileUrl;
      const res = await fetch(requestUrl, {
        cache: force ? "no-store" : "default",
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      // Keep blob URL for the "Place Signature" button trigger
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      // Pass ArrayBuffer directly — avoids "response (0)" error when worker fetches blob URL
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      await renderPage(doc, 1);
    } catch (e: any) {
      setPdfError(e?.message || "Failed to load PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [pdfBlobUrl, renderPage]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  // ----- Credentials (pre-filled from localStorage) -----
  const [p12File, setP12File]         = useState<File | null>(null);
  const [p12FileName, setP12FileName] = useState("");
  const [password, setPassword]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sigPos, setSigPos]           = useState("");
  const [signImage, setSignImage]     = useState<File | null>(null);
  const [signImagePreview, setSignImagePreview] = useState("");
  const [textSize, setTextSize]       = useState(12);
  const [imgWidth, setImgWidth]       = useState(150);
  // Stamp element positions loaded from SignatureSettings (% from top/left of stamp box)
  const [sigImgTop,  setSigImgTop]  = useState(5);
  const [sigImgLeft, setSigImgLeft] = useState(50);
  const [sigTxtTop,  setSigTxtTop]  = useState(55);
  const [sigTxtLeft, setSigTxtLeft] = useState(50);

  // ----- Signature placement (PDF pts, origin top-left) -----
  const [sigX, setSigX]     = useState(170);   // pts from left
  const [sigY, setSigY]     = useState(720);   // pts from top
  const [sigBoxW, setSigBoxW] = useState(Number(localStorage.getItem("sig_stamp_width")) || 220); // pts
  const [sigBoxH, setSigBoxH] = useState(Number(localStorage.getItem("sig_stamp_height")) || 80); // pts
  const [sigPage, setSigPage] = useState(1);

  // Re-render canvas when user changes page
  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, sigPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigPage, pdfDoc]);

  // Global mouse handlers for drag-to-move and drag-to-resize on confirmed stamp
  useEffect(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const onMove = (e: MouseEvent) => {
      if (draggingStamp.current) {
        const { startX, startY, origX, origY } = draggingStamp.current;
        const dx = (e.clientX - startX) / renderScale;
        const dy = (e.clientY - startY) / renderScale;
        setSigX(clamp(origX + dx, 0, pdfPageWidth  - sigBoxW));
        setSigY(clamp(origY - dy, 0, pdfPageHeight - sigBoxH));
      }
      if (resizingStamp.current) {
        const { startX, startY, origW, origH, origY } = resizingStamp.current;
        const dw = (e.clientX - startX) / renderScale;
        const dh = (e.clientY - startY) / renderScale;
        const newW = clamp(origW + dw, 40,  pdfPageWidth);
        const newH = clamp(origH + dh, 20,  pdfPageHeight);
        setSigBoxW(Math.round(newW));
        setSigBoxH(Math.round(newH));
        // expand downward: bottom edge moves down → sigY decreases
        setSigY(clamp(origY - dh, 0, pdfPageHeight - 20));
      }
    };
    const onUp = () => { draggingStamp.current = null; resizingStamp.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderScale, pdfPageWidth, pdfPageHeight, sigBoxW, sigBoxH]);

  // Keep the stamp box anchored within the visible page when size changes.
  useEffect(() => {
    setSigX(prev => Math.max(0, Math.min(prev, pdfPageWidth - sigBoxW)));
    setSigY(prev => Math.max(0, Math.min(prev, pdfPageHeight - sigBoxH)));
  }, [pdfPageWidth, pdfPageHeight, sigBoxW, sigBoxH]);
  // Derived
  const mySig: DocumentSignatory | undefined = doc?.signatories.find(s => s.user_id === user?.id);
  const isOwner  = doc?.userID === user?.id;
  // Allow owner and assigned signatories (pending or already signed) to sign again.
  const canSign  = !!doc && (
    isOwner || mySig?.status === "pending" || mySig?.status === "signed"
  );

  // ── Decline state ───────────────────────────────────────────────────────────
  const [declineOpen,   setDeclineOpen]   = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  // ── Sign remarks ─────────────────────────────────────────────────────────────
  const [signRemarks, setSignRemarks] = useState("");
  const [declining,     setDeclining]     = useState(false);
  // ── Manual sign mode ─────────────────────────────────────────────────────────
  const [signMode,        setSignMode]        = useState<"digital" | "manual">("digital");
  const [manualUploading, setManualUploading] = useState(false);
  const [manualDragging,  setManualDragging]  = useState(false);

  const handleDecline = async () => {
    if (!mySig) return;
    setDeclining(true);
    try {
      await signatoryApi.update(mySig.id, { status: "rejected", remarks: declineReason });
      setDeclineOpen(false);
      // Refresh doc
      const updated = await documentApi.getByTrack(doc!.tracknumber);
      setDoc(updated);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to decline. Please try again.");
      setDeclineOpen(false);
    } finally {
      setDeclining(false);
    }
  };


  // Load all sig settings from localStorage on mount
  useEffect(() => {
    setPassword(localStorage.getItem("sig_password")    || "");
    setDisplayName(localStorage.getItem("sig_displayName") || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim());
    setSigPos(localStorage.getItem("sig_position")    || user?.position || "");
    setTextSize(Number(localStorage.getItem("sig_text_size"))    || 12);
    setImgWidth(Number(localStorage.getItem("sig_image_width")) || 150);
    setSigBoxW(Number(localStorage.getItem("sig_stamp_width")) || 220);
    setSigBoxH(Number(localStorage.getItem("sig_stamp_height")) || 80);
    setSigImgTop(Number(localStorage.getItem("sig_img_top"))   || 5);
    setSigImgLeft(Number(localStorage.getItem("sig_img_left"))  || 50);
    setSigTxtTop(Number(localStorage.getItem("sig_txt_top"))    || 55);
    setSigTxtLeft(Number(localStorage.getItem("sig_txt_left"))  || 50);

    // Restore P12 from localStorage
    const p12b64  = localStorage.getItem("sig_p12_data");
    const p12name = localStorage.getItem("sig_p12_name") || "certificate.p12";
    if (p12b64) {
      try {
        setP12File(base64ToFile(p12b64, p12name, "application/x-pkcs12"));
        setP12FileName(p12name);
      } catch {}
    }

    // Restore signature image from localStorage
    const imgData = localStorage.getItem("sig_image_data");
    if (imgData) {
      setSignImagePreview(imgData);
      try {
        const [hdr, b64] = imgData.split(",");
        const mime = hdr?.match(/:(.*?);/)?.[1] || "image/png";
        setSignImage(base64ToFile(b64, "signature.png", mime));
      } catch {}
    }
  }, [user?.first_name, user?.last_name, user?.position]);

  useEffect(() => {
    if (!tracknumber) return;
    const controller = new AbortController();
    documentApi.getByTrack(tracknumber, controller.signal)
      .then(d => {
        setDoc(d);
        const firstFile = d.files && d.files.length > 0 ? d.files[0] : null;
        const fileToLoad = firstFile?.file_url || d.file_url || null;
        setSelectedFileUrl(fileToLoad);
        if (firstFile) setActiveDocFile(firstFile);
        if (fileToLoad && pdfVisible) loadPdf(fileToLoad);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        const httpStatus = err?.response?.status;
        if (httpStatus === 403) {
          setError("unauthorized");
        } else if (httpStatus === 404) {
          setError("Document not found.");
        } else {
          setError("Failed to load document.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracknumber]);

  // --- Live placement overlay handlers ---
  // --- Overlay event handler: uses exact renderScale from pdfjs canvas rendering ---
  const handleOverlayEvent = (e: React.MouseEvent<HTMLDivElement>, isClick: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sc   = renderScale;               // exact scale from canvas render, not estimated
    const px   = e.clientX - rect.left;
    const py   = e.clientY - rect.top;
    const sw   = sigBoxW * sc;              // stamp width in CSS px
    const sh   = sigBoxH * sc;              // stamp height in CSS px
    const left = Math.max(0, Math.min(rect.width  - sw, px - sw / 2));
    const top  = Math.max(0, Math.min(rect.height - sh, py - sh / 2));
    if (isClick) {
      // x: from left edge (PDF left-origin)
      const newX = Math.max(0, Math.min(pdfPageWidth  - sigBoxW, px / sc - sigBoxW / 2));
      // y: PDF origin is bottom-left — flip from top-down overlay coords
      const newY = Math.max(0, Math.min(pdfPageHeight - sigBoxH, pdfPageHeight - py / sc - sigBoxH / 2));
      setSigX(newX);
      setSigY(newY);
      setStampPlaced(true);
      setPlacingMode(false);
      setHoverPx(null);
      // Save stamp to per-file ref immediately on placement
      if (activeDocFile) {
        const cfg: FileStampConfig = {
          sigX: newX, sigY: newY, sigPage, sigBoxW, sigBoxH,
          placed: true, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
        };
        fileStampRef.current[activeDocFile.id] = cfg;
        setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
      }
    } else {
      setHoverPx({ left, top });
    }
  };

  // --- Switch active document file (saves current stamp, restores saved stamp) ---
  const switchToFile = (newFile: DocumentFile) => {
    // Save the current stamp state before switching
    if (activeDocFile) {
      const cfg: FileStampConfig = {
        sigX, sigY, sigPage, sigBoxW, sigBoxH,
        placed: stampPlaced, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
      };
      fileStampRef.current[activeDocFile.id] = cfg;
      setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
    }
    // Restore the new file's stamp (or reset to defaults)
    const saved = fileStampRef.current[newFile.id];
    if (saved) {
      setSigX(saved.sigX); setSigY(saved.sigY); setSigPage(saved.sigPage);
      setSigBoxW(saved.sigBoxW); setSigBoxH(saved.sigBoxH);
      setStampPlaced(saved.placed);
    } else {
      setSigX(170); setSigY(720); setSigPage(1); setStampPlaced(false);
    }
    setPlacingMode(false); setHoverPx(null);
    setActiveDocFile(newFile);
    setSelectedFileUrl(newFile.file_url);
    setPdfVisible(true);
    loadPdf(newFile.file_url, { force: true });
  };

  // --- P12 file picker (also saves to localStorage) ---
  const handleP12Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setP12File(file);
    setP12FileName(file.name);
    try {
      const b64 = await fileToBase64(file);
      localStorage.setItem("sig_p12_data", b64);
      localStorage.setItem("sig_p12_name", file.name);
    } catch {}
  };

  // --- Signature image picker (also saves to localStorage) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSignImagePreview(dataUrl);
      localStorage.setItem("sig_image_data", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Build a composite PNG that matches the Stamp Designer preview exactly.
   * Canvas proportions are ratio-based (W=1000, H derived from w/h ratio)
   * so the server receives a correctly proportioned image regardless of pts.
   * Sent as `sign_design`; the server uses it directly as the stamp visual.
   */
  const buildStampCanvas = (): Promise<Blob | null> =>
    new Promise(resolve => {
      const W = 1000;
      // H must match the stamp box aspect ratio directly.
      // Using hRatio/wRatio introduces a page-aspect skew (595≠842) that
      // causes the server to stretch/crop the image. Use sigBoxH/sigBoxW.
      const H = Math.max(160, Math.round(W * (sigBoxH / sigBoxW)));
      const canvas = document.createElement("canvas");
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);

      // Font size: textSize is in PDF pts; scale to canvas pixels
      const ptToPx  = H / sigBoxH;
      const nameFs  = textSize * ptToPx;
      const posFs   = Math.max(6, (textSize - 2)) * ptToPx;

      const drawText = () => {
        const tx = (sigTxtLeft / 100) * W;
        const ty = (sigTxtTop  / 100) * H;
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        if (displayName) {
          ctx.font      = `bold ${nameFs}px sans-serif`;
          ctx.fillStyle = "#1e3a5f";
          ctx.fillText(displayName, tx, ty);
        }
        if (sigPos) {
          ctx.font      = `${posFs}px sans-serif`;
          ctx.fillStyle = "#2563EB";
          ctx.fillText(sigPos, tx, ty + nameFs * 1.35);
        }
        canvas.toBlob(b => resolve(b), "image/png");
      };

      if (signImagePreview) {
        const img = new Image();
        img.onload = () => {
          // imgWidth is in "designer px" (designer box = 330 px wide = sigBoxW pts)
          const imgPxOnCanvas = (imgWidth / sigBoxW) * W;
          const ih = img.naturalHeight * (imgPxOnCanvas / Math.max(1, img.naturalWidth));
          const ix = (sigImgLeft / 100) * W - imgPxOnCanvas / 2;
          const iy = (sigImgTop  / 100) * H;
          ctx.drawImage(img, ix, iy, imgPxOnCanvas, ih);
          drawText();
        };
        img.onerror = drawText;
        img.src = signImagePreview;
      } else {
        drawText();
      }
    });

  const handleSign = async () => {
    if (!doc) return;
    if (!p12File) { setError("Please select your P12/PFX certificate file."); return; }
    if (!password) { setError("Please enter your P12 password."); return; }
    if (!PNPKI_URL) { setError("PNPKI server URL is not configured."); return; }

    // Save current active file's stamp state before iterating
    if (activeDocFile) {
      const cfg: FileStampConfig = {
        sigX, sigY, sigPage, sigBoxW, sigBoxH,
        placed: stampPlaced, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
      };
      fileStampRef.current[activeDocFile.id] = cfg;
      setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
    }

    // Determine which files have a placed stamp
    const allDocFiles = doc.files || [];
    const filesToSign = allDocFiles.filter(f => fileStampRef.current[f.id]?.placed);
    if (filesToSign.length === 0) {
      setError("Place your signature on at least one document file first.");
      return;
    }

    setSigning(true);
    setError(null);
    const collected: Array<{ blob: Blob; name: string }> = [];
    try {
      // Build the composite stamp image once (shared across all files)
      const compositeBlob = await buildStampCanvas();
      const tok = localStorage.getItem("auth_token");

      const uploadFd = new FormData();

      for (let i = 0; i < filesToSign.length; i++) {
        const docFile = filesToSign[i];
        const cfg     = fileStampRef.current[docFile.id];

        // ── Fetch this file's PDF ─────────────────────────────────────
        const res = await fetch(docFile.file_url, {
          headers: tok ? { Authorization: `Token ${tok}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to fetch file ${i + 1}: HTTP ${res.status}`);
        const pdfBlob = await res.blob();

        // ── Call PNPKI to sign with this file's stamp coords ──────────
        const xRatio = cfg.sigX / cfg.pdfW;
        const wRatio = cfg.sigBoxW / cfg.pdfW;
        const hRatio = cfg.sigBoxH / cfg.pdfH;
        const yRatio = (cfg.pdfH - cfg.sigY - cfg.sigBoxH) / cfg.pdfH;

        const fd = new FormData();
        fd.append("pdf_file",    pdfBlob,  `${doc.tracknumber}-${i}.pdf`);
        fd.append("p12_file",    p12File,  p12File.name);
        fd.append("password",    password);
        fd.append("signer_name", displayName || `${user?.first_name} ${user?.last_name}`);
        fd.append("sign_note",   sigPos || user?.position || "");
        fd.append("page",        String(cfg.sigPage));
        fd.append("sign_all_pages", "false");
        fd.append("x_ratio", String(xRatio));
        fd.append("y_ratio", String(yRatio));
        fd.append("w_ratio", String(wRatio));
        fd.append("h_ratio", String(hRatio));
        if (compositeBlob)
          fd.append("sign_design", new File([compositeBlob], "sign-design.png", { type: "image/png" }));
        if (signImage)
          fd.append("sign_image", signImage, "signature.png");

        const signRes = await fetch(`${PNPKI_URL}/sign-pdf`, { method: "POST", body: fd });
        if (!signRes.ok) {
          const msg = await signRes.text();
          throw new Error(msg || `PNPKI server error on file ${i + 1}.`);
        }
        const signedPdfBlob = await signRes.blob();
        const signedName    = `${doc.tracknumber}-signed-${i + 1}.pdf`;
        collected.push({ blob: signedPdfBlob, name: signedName });

        // Add to the single batch upload
        uploadFd.append(`file_${i}`,    signedPdfBlob, signedName);
        uploadFd.append(`file_id_${i}`, String(docFile.id));
      }

      setSignedBlobs(collected);

      // ── Single request to replace all original files ─────────────────
      const uploadRes = await fetch(`${SERVER_URL}/document/${doc.id}/sign_files/`, {
        method:  "PATCH",
        headers: tok ? { Authorization: `Token ${tok}` } : {},
        body:    uploadFd,
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} – ${txt}`);
      }

      const updatedDoc = await uploadRes.json().catch(() => null);
      if (updatedDoc) setDoc(updatedDoc);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Signing failed. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = () => {
    if (!signedBlobs.length || !doc) return;
    for (const { blob, name } of signedBlobs) {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /** Download all document files (originals / signed) for printing/archival */
  const handleDownloadFiles = async () => {
    if (!doc) return;
    const filesToDownload = doc.files?.length
      ? doc.files
      : doc.file_url ? [{ file_url: doc.file_url, id: -1 }] : [];
    if (!filesToDownload.length) return;
    try {
      const tok = localStorage.getItem("auth_token");
      for (let i = 0; i < filesToDownload.length; i++) {
        const f   = filesToDownload[i];
        const url = f.file_url;
        if (!url) continue;
        const res = await fetch(url, { headers: tok ? { Authorization: `Token ${tok}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a    = document.createElement("a");
        a.href     = URL.createObjectURL(blob);
        a.download = filesToDownload.length > 1
          ? `${doc.tracknumber} - ${doc.title} (${i + 1}).pdf`
          : `${doc.tracknumber} - ${doc.title}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        // Brief pause between multiple downloads so the browser doesn't block them
        if (i < filesToDownload.length - 1) await new Promise(r => setTimeout(r, 350));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to download PDF.");
    }
  };

  const handleManualSign = async () => {
    if (!doc) return;
    const entries = Object.entries(manualSignedFiles);
    if (entries.length === 0) return;
    setManualUploading(true);
    setError(null);
    try {
      const token  = localStorage.getItem("auth_token");
      const uploadFd = new FormData();
      entries.forEach(([fileId, file], i) => {
        uploadFd.append(`file_${i}`,    file,    file.name);
        uploadFd.append(`file_id_${i}`, fileId);
      });
      const uploadRes = await fetch(`${SERVER_URL}/document/${doc.id}/sign_files/`, {
        method:  "PATCH",
        headers: token ? { Authorization: `Token ${token}` } : {},
        body:    uploadFd,
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} – ${txt}`);
      }
      const updatedDoc = await uploadRes.json().catch(() => null);
      if (updatedDoc) setDoc(updatedDoc);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setManualUploading(false);
    }
  };


  if (loading) return (
    <UserLayout title="Sign Document">
      <div className="space-y-3 max-w-3xl">
        {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-accent/40 animate-pulse" />)}
      </div>
    </UserLayout>
  );

  if (error === "unauthorized") return (
    <UserLayout title="Sign Document">
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You are not authorized to view this document.<br />
            Only the document owner, assigned signatories, and administrators can access it.
          </p>
        </div>
        <button
          onClick={() => navigate("/dtms/user/documents")}
          className="mt-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition"
        >
          Back to My Documents
        </button>
      </div>
    </UserLayout>
  );

  if (error && !doc) return (
    <UserLayout title="Sign Document">
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Document Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <button
          onClick={() => navigate("/dtms/user/documents")}
          className="mt-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition"
        >
          Back to My Documents
        </button>
      </div>
    </UserLayout>
  );

  return (
    <UserLayout title="Sign Document" subtitle={doc ? `${doc.tracknumber} — ${doc.title}` : "Loading..."}>
      <div className="space-y-1">

        {/* ── Success state ─────────────────────────────────────────── */}
        {done && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-6 py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Document Signed Successfully!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The signed PDF has been uploaded. You can sign again if you need to add another signature placement.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
                <Download className="w-4 h-4" /> Download Signed PDF
              </button>
              {canSign && (
                <button
                  onClick={() => {
                    setDone(false);
                    setPdfVisible(true);
                    setPlacingMode(true);
                    setHoverPx(null);
                    const urlToLoad = activeDocFile?.file_url || doc?.file_url;
                    if (urlToLoad) void loadPdf(urlToLoad, { force: true });
                  }}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition"
                >
                  Add Another Signature
                </button>
              )}
              <button onClick={() => navigate("/dtms/user/documents")}
                className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
                Back to Documents
              </button>
            </div>
          </div>
        )}

        {!done && (
          <div className="grid grid-cols-[1fr_360px] gap-5 items-start lg:grid-cols-1">

                {/* ══════════════════════════════════════════
                RIGHT COLUMN — PDF viewer
                ══════════════════════════════════════════ */}
            <div className="min-w-0 sticky top-4 lg:static">
              {doc && selectedFileUrl ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col ">

                  {/* File tabs — shown when document has multiple files */}
                  {doc.files && doc.files.length > 1 && (
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 flex-wrap border-b border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mr-1">Files:</span>
                      {doc.files.map((f, idx) => {
                        const cfg      = fileStampsState[f.id];
                        const isActive = activeDocFile?.id === f.id;
                        return (
                          <button
                            key={f.id}
                            onClick={() => switchToFile(f)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-accent text-foreground hover:bg-accent/70"
                            }`}
                          >
                            {cfg?.placed
                              ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                              : <FileText className="w-3 h-3 shrink-0 opacity-60" />}
                            File {idx + 1}
                          
                          </button>
                        );
                      })}
                      {canSign && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {Object.values(fileStampsState).filter(c => c.placed).length}/{doc.files.length} stamped
                        </span>
                      )}
                    </div>
                  )}

                  {/* Header bar */}
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
                    <Eye className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">View Document</span>
                    {pdfLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />}
                    {pdfDoc && (
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={() => setSigPage(p => Math.max(1, p - 1))}
                          disabled={sigPage <= 1}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition"
                          title="Previous page">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground font-mono select-none">
                          {sigPage} / {pdfDoc.numPages}
                        </span>
                        <button
                          onClick={() => setSigPage(p => Math.min(pdfDoc.numPages, p + 1))}
                          disabled={sigPage >= pdfDoc.numPages}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition"
                          title="Next page">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {canSign && pdfBlobUrl && !placingMode && (
                        <button
                          onClick={() => { setPdfVisible(true); setPlacingMode(true); setHoverPx(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">
                          <MousePointer2 className="w-3.5 h-3.5" /> Place Signature
                        </button>
                      )}
                      {canSign && placingMode && (
                        <button
                          onClick={() => { setPlacingMode(false); setHoverPx(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition">
                          Cancel Placement
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const next = !pdfVisible;
                          setPdfVisible(next);
                          if (next && selectedFileUrl) loadPdf(selectedFileUrl);
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
                        title={pdfVisible ? "Collapse" : "Expand"}>
                        {pdfVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {pdfVisible && (
                    <div className="overflow-y-auto flex-1">
                      {pdfLoading && (
                        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
                          <Loader2 className="w-5 h-5 animate-spin" /> Loading PDF…
                        </div>
                      )}
                      {pdfError && (
                        <div className="flex items-center gap-2 px-5 py-4 text-destructive text-sm">
                          <AlertTriangle className="w-4 h-4 shrink-0" /> {pdfError}
                        </div>
                      )}
                      {pdfDoc && !pdfLoading && (
                        <div ref={viewerContainerRef} className="relative w-full" style={{ background: "#e5e7eb" }}>
                          <canvas ref={canvasRef} className="block" />

                          {/* Placement overlay */}
                          {placingMode && (
                            <div
                              className="absolute inset-0 cursor-crosshair"
                              style={{ pointerEvents: "auto", zIndex: 10 }}
                              onMouseMove={e => handleOverlayEvent(e, false)}
                              onMouseLeave={() => setHoverPx(null)}
                              onClick={e => handleOverlayEvent(e, true)}
                            >
                              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                              <div className="absolute top-0 inset-x-0 bg-blue-600/90 text-white text-xs px-4 py-2 flex items-center justify-between pointer-events-none">
                                <span className="flex items-center gap-1.5"><MousePointer2 className="w-3.5 h-3.5" /> Click to place your signature stamp on the document</span>
                                <span className="font-mono opacity-75">
                                  {hoverPx ? `x:${Math.round(sigX)} y:${Math.round(sigY)} pg:${sigPage}` : "Move cursor to preview"}
                                </span>
                              </div>
                              {hoverPx && (
                                <div
                                  className="absolute border-2 border-blue-400 rounded pointer-events-none overflow-hidden"
                                  style={{
                                    left:   hoverPx.left,
                                    top:    hoverPx.top,
                                    width:  sigBoxW * renderScale,
                                    height: sigBoxH * renderScale,
                                    background: "rgba(59,130,246,0.15)",
                                    boxShadow: "0 0 0 1px rgba(59,130,246,0.6)",
                                  }}
                                >
                                  {signImagePreview && (
                                    <img src={signImagePreview} alt="sig"
                                      className="absolute object-contain pointer-events-none"
                                      style={{
                                        top:       `${sigImgTop}%`,
                                        left:      `${sigImgLeft}%`,
                                        transform: "translate(-50%, 0)",
                                        width:     imgWidth * renderScale,
                                        maxWidth:  "90%",
                                      }} />
                                  )}
                                  <div className="absolute text-center" style={{ top: `${sigTxtTop}%`, left: `${sigTxtLeft}%`, transform: "translate(-50%, 0)", whiteSpace: "nowrap" }}>
                                    <p className="font-bold text-blue-900 text-center truncate px-0.5"
                                      style={{ fontSize: Math.max(7, textSize * renderScale) }}>
                                      {displayName || `${user?.first_name} ${user?.last_name}`}
                                    </p>
                                    {(sigPos || user?.position) && (
                                      <p className="text-blue-700 text-center truncate px-0.5"
                                        style={{ fontSize: Math.max(6, (textSize - 2) * renderScale) }}>
                                        {sigPos || user?.position}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Confirmed stamp — draggable + resizable */}
                          {!placingMode && stampPlaced && (() => {
                            const cssLeft = sigX * renderScale;
                            const cssTop  = (pdfPageHeight - sigY - sigBoxH) * renderScale;
                            const cssW    = sigBoxW * renderScale;
                            const cssH    = sigBoxH * renderScale;
                            return (
                              <div
                                className="absolute border-2 border-blue-500 rounded overflow-hidden select-none"
                                style={{ left: cssLeft, top: cssTop, width: cssW, height: cssH,
                                         background: "rgba(59,130,246,0.10)", zIndex: 5, pointerEvents: "all" }}
                              >
                                <div
                                  className="absolute top-0 left-0 right-0 flex items-center justify-center bg-blue-600/80 cursor-move z-10"
                                  style={{ height: Math.max(10, 14 * renderScale) }}
                                  onMouseDown={e => {
                                    e.preventDefault(); e.stopPropagation();
                                    draggingStamp.current = { startX: e.clientX, startY: e.clientY, origX: sigX, origY: sigY };
                                  }}
                                >
                                  <span style={{ fontSize: Math.max(7, 9 * renderScale), color: "white", opacity: 0.9, letterSpacing: 2 }}>⠿</span>
                                </div>
                                <div className="absolute inset-0 overflow-hidden pointer-events-none"
                                  style={{ paddingTop: Math.max(10, 14 * renderScale) }}>
                                  {signImagePreview && (
                                    <img src={signImagePreview} alt="sig"
                                      className="absolute object-contain"
                                      style={{ top: `${sigImgTop}%`, left: `${sigImgLeft}%`,
                                               transform: "translate(-50%, 0)", width: imgWidth * renderScale,
                                               maxWidth: "90%" }} />
                                  )}
                                  <div className="absolute text-center"
                                    style={{ top: `${sigTxtTop}%`, left: `${sigTxtLeft}%`,
                                             transform: "translate(-50%, 0)", whiteSpace: "nowrap" }}>
                                    <p className="font-bold text-blue-900 truncate px-0.5"
                                      style={{ fontSize: Math.max(7, textSize * renderScale) }}>
                                      {displayName || `${user?.first_name} ${user?.last_name}`}
                                    </p>
                                    {(sigPos || user?.position) && (
                                      <p className="text-blue-700 truncate px-0.5"
                                        style={{ fontSize: Math.max(6, (textSize - 2) * renderScale) }}>
                                        {sigPos || user?.position}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div
                                  className="absolute bottom-0 right-0 flex items-center justify-center bg-blue-600 cursor-se-resize z-10"
                                  style={{ width: Math.max(10, 14 * renderScale), height: Math.max(10, 14 * renderScale),
                                           borderTopLeftRadius: 3, color: "white", fontSize: Math.max(8, 10 * renderScale) }}
                                  onMouseDown={e => {
                                    e.preventDefault(); e.stopPropagation();
                                    resizingStamp.current = { startX: e.clientX, startY: e.clientY,
                                                              origW: sigBoxW, origH: sigBoxH, origY: sigY };
                                  }}
                                >⌟</div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                  )}

                  {/* Stamp controls bar */}
                  {canSign && (stampPlaced || placingMode) && (
                    <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 bg-accent/30">
                      <span className="text-xs font-medium text-muted-foreground">Stamp</span>
                      <label className="flex items-center gap-1.5 text-xs text-foreground">
                        Page
                        <input type="number" min={1} value={sigPage}
                          onChange={e => setSigPage(Math.max(1, Number(e.target.value)))}
                          className="w-14 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      </label>
                      {stampPlaced && (
                        <>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="font-mono">⠿</span> drag bar to move &nbsp;·&nbsp; <span className="font-mono">⌟</span> corner to resize
                          </span>
                          <span className="text-xs text-muted-foreground font-mono ml-auto">
                            {Math.round(sigBoxW)}×{Math.round(sigBoxH)} &nbsp; x:{Math.round(sigX)} y:{Math.round(sigY)} pg:{sigPage}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl px-5 py-12 flex flex-col items-center gap-3 text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p>No document file attached.</p>
                </div>
              )}
            </div>{/* end RIGHT column */}


            {/* ══════════════════════════════════════════
                LEFT COLUMN — details, credentials, actions
                ══════════════════════════════════════════ */}
            <div className="flex flex-col gap-4 min-w-0">

              {/* ── Document info card ──────────────────────────── */}
              {doc && (
                <div className="bg-card border border-border rounded-xl px-5 py-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.tracknumber} · {doc.type}</p>
                      <p className="text-xs text-muted-foreground">Submitted by: {doc.requestor}{doc.position ? `, ${doc.position}` : ""}</p>
                      {doc.message && (
                        <p className="text-xs text-muted-foreground mt-1 border-t border-border pt-1 italic">{doc.message}</p>
                      )}
                    </div>
                    {isOwner && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">Owner</span>
                    )}
                  </div>

                  {/* Signatories grouped by office */}
                  {doc.signatories.length > 0 && (() => {
                    const sortedByOrder = [...doc.signatories].sort((a, b) => a.order - b.order);
                    const ownerId = doc.userID;
                    const sorted = [...sortedByOrder].sort((a, b) => {
                      const aIsOwner = a.user_id === ownerId ? 0 : 1;
                      const bIsOwner = b.user_id === ownerId ? 0 : 1;
                      if (aIsOwner !== bIsOwner) return aIsOwner - bIsOwner;

                      if (a.order !== b.order) return a.order - b.order;
                      return a.id - b.id;
                    });
                    // Map each unique order value → display step number (1, 2, 3...)
                    const uniqueOrders = [...new Set(sorted.map(s => s.order))].sort((a, b) => a - b);
                    const orderToStep: Record<number, number> = {};
                    uniqueOrders.forEach((o, i) => { orderToStep[o] = i + 1; });
                    // Group by office, preserving order of first appearance
                    const officeGroups: Array<{ office: string; sigs: typeof sorted }> = [];
                    const seenOffices = new Set<string>();
                    sorted.forEach(s => {
                      const office = s.user_office?.trim() || "—";
                      if (!seenOffices.has(office)) {
                        seenOffices.add(office);
                        officeGroups.push({ office, sigs: [] });
                      }
                      officeGroups.find(g => g.office === office)!.sigs.push(s);
                    });
                    return (
                      <div className="mt-4 border-t border-border pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Signatories</p>
                        <div className="flex flex-col gap-4">
                          {officeGroups.map(({ office, sigs }) => (
                            <div key={office}>
                              {/* Office header */}
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 px-1">{office}</p>
                              <div className="flex flex-col gap-1.5">
                                {sigs.map(s => (
                                  <div key={s.id} className={`rounded-lg border px-3 py-2.5 text-xs ${
                                    s.status === "signed"   ? "border-green-500/30 bg-green-500/5" :
                                    s.status === "rejected" ? "border-destructive/30 bg-destructive/5" :
                                                              "border-border bg-accent/30"
                                  }`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="w-5 h-5 rounded-full bg-accent text-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{orderToStep[s.order]}</span>
                                      <span className="text-foreground font-medium">{s.user_name}</span>
                                      {s.user_id === doc.userID && (
                                        <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Owner</span>
                                      )}
                                      {s.user_id === user?.id && (
                                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">You</span>
                                      )}
                                      <span className="text-muted-foreground truncate hidden sm:inline">{s.user_email}</span>
                                      <span className={`ml-auto px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${
                                        s.status === "signed"   ? "bg-green-500/10 text-green-600" :
                                        s.status === "rejected" ? "bg-destructive/10 text-destructive" :
                                                                  "bg-yellow-500/10 text-yellow-600"
                                      }`}>{s.status}</span>
                                    </div>
                                    {s.signed_at && (
                                      <p className="mt-1 text-muted-foreground pl-7">
                                        {s.status === "rejected" ? "Declined" : "Signed"} on{" "}
                                        {fmtSignedAt(s.signed_at)}
                                      </p>
                                    )}
                                    {s.remarks && (
                                      <p className={`mt-1 pl-7 italic text-xs ${
                                        s.status === "rejected" ? "text-destructive/80" : "text-muted-foreground"
                                      }`}>
                                        {s.status === "rejected" ? "Reason" : "Remarks"}: {s.remarks}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Document files ──────────────────────────────── */}
              {doc && (
                <div className="bg-card border border-border rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Files</span>
                    {doc.files && doc.files.length > 0 && (
                      <button
                        onClick={handleDownloadFiles}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title={doc.files.length > 1 ? `Download all ${doc.files.length} files` : "Download PDF"}>
                        <Download className="w-3.5 h-3.5" />
                        {doc.files.length > 1 ? `Download all (${doc.files.length})` : "Download"}
                      </button>
                    )}
                  </div>
                  <DocumentFileList 
                    document={doc} 
                    onFileSelect={(fileUrl) => {
                      // Sync the file tabs above the viewer
                      const matched = doc.files?.find(f => f.file_url === fileUrl);
                      if (matched) {
                        switchToFile(matched);
                      } else {
                        setSelectedFileUrl(fileUrl);
                        setPdfVisible(true);
                        loadPdf(fileUrl, { force: true });
                      }
                    }}
                    selectedFileUrl={selectedFileUrl}
                  />
                </div>
              )}

              {/* ── Already signed banner ───────────────────────── */}
              {mySig && mySig.status === "signed" && !isOwner && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <p className="text-sm text-foreground">
                    You signed this document{mySig.signed_at ? ` on ${fmtSignedAt(mySig.signed_at)}` : ""}.
                  </p>
                </div>
              )}

              {/* ── Signing panel ───────────────────────────────── */}
              {canSign && (
                <div className="flex flex-col gap-4">

                  {/* Mode toggle */}
                  <div className="flex rounded-xl border border-border bg-accent/40 p-1 gap-1">
                    <button
                      onClick={() => setSignMode("digital")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        signMode === "digital"
                          ? "bg-card shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <Key className="w-3.5 h-3.5" /> Digital (PNPKI)
                    </button>
                    <button
                      onClick={() => setSignMode("manual")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        signMode === "manual"
                          ? "bg-card shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <PenLine className="w-3.5 h-3.5" /> Manual / Handwritten
                    </button>
                  </div>

                  {/* ── Manual sign panel ── */}
                  {signMode === "manual" && (
                    <div className="flex flex-col gap-4">
                      {/* Step 1 — download all files */}
                      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                          <p className="text-sm font-medium text-foreground">Print the document{doc && doc.files && doc.files.length > 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-8">
                          Download {doc && doc.files && doc.files.length > 1 ? `all ${doc.files.length} files` : "the PDF"}, print, sign by hand, then scan each one.
                        </p>
                        <button
                          onClick={handleDownloadFiles}
                          className="ml-8 flex items-center gap-2 w-fit px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-accent transition">
                          <Printer className="w-4 h-4" /> Download for Printing
                          {doc && doc.files && doc.files.length > 1 && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{doc.files.length} files</span>
                          )}
                        </button>
                      </div>

                      {/* Step 2 — upload signed scans (one per file) */}
                      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                          <p className="text-sm font-medium text-foreground">Upload the signed scan{doc && doc.files && doc.files.length > 1 ? "s" : ""}</p>
                        </div>
                        {/* One upload zone per document file */}
                        {(doc?.files && doc.files.length > 0 ? doc.files : []).map((docFile, idx) => {
                          const uploaded = manualSignedFiles[docFile.id];
                          return (
                            <div key={docFile.id} className="ml-8 flex flex-col gap-1">
                              {doc!.files!.length > 1 && (
                                <span className="text-xs font-medium text-muted-foreground">File {idx + 1}</span>
                              )}
                              <label
                                onDragOver={e => { e.preventDefault(); setManualDragging(true); }}
                                onDragEnter={e => { e.preventDefault(); setManualDragging(true); }}
                                onDragLeave={() => setManualDragging(false)}
                                onDrop={e => {
                                  e.preventDefault(); setManualDragging(false);
                                  const f = e.dataTransfer.files[0];
                                  if (f && f.type === "application/pdf")
                                    setManualSignedFiles(prev => ({ ...prev, [docFile.id]: f }));
                                }}
                                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition ${
                                  manualDragging
                                    ? "border-primary bg-primary/5"
                                    : uploaded
                                    ? "border-green-500/50 bg-green-500/5"
                                    : "border-border bg-background hover:border-primary/40"
                                }`}>
                                {uploaded ? (
                                  <>
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <p className="text-sm font-medium text-foreground text-center truncate max-w-[220px]">{uploaded.name}</p>
                                    <p className="text-xs text-muted-foreground">{(uploaded.size / 1024).toFixed(0)} KB — click to replace</p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-5 h-5 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Drop PDF here or <span className="text-primary font-medium">click to browse</span></p>
                                    <p className="text-xs text-muted-foreground">Scanned / photographed copy (PDF only)</p>
                                  </>
                                )}
                                <input type="file" accept="application/pdf" className="hidden"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) setManualSignedFiles(prev => ({ ...prev, [docFile.id]: f }));
                                  }} />
                              </label>
                            </div>
                          );
                        })}
                      </div>

                      {/* Remarks */}
                      {mySig && mySig.status === "pending" && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">
                            Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={signRemarks}
                            onChange={e => setSignRemarks(e.target.value)}
                            placeholder="Add a note about your signature..."
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition"
                          />
                        </div>
                      )}

                      {/* Error */}
                      {error && (
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                          <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                        </div>
                      )}

                      {/* Submit + Decline */}
                      <div className="flex gap-2">
                        {mySig && mySig.status === "pending" && (
                          <button onClick={() => setDeclineOpen(true)} disabled={manualUploading}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-destructive/60 text-destructive text-sm font-semibold hover:bg-destructive/10 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        )}
                        <button
                          onClick={handleManualSign}
                          disabled={manualUploading || Object.keys(manualSignedFiles).length === 0}
                          title={Object.keys(manualSignedFiles).length === 0 ? "Upload at least one signed scan first" : undefined}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {manualUploading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                            : <><PenLine className="w-4 h-4" /> Submit Signed {Object.keys(manualSignedFiles).length > 1 ? `(${Object.keys(manualSignedFiles).length} files)` : "Copy"}</>}
                        </button>
                      </div>
                      {Object.keys(manualSignedFiles).length === 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                          ⚠ Upload your scanned signed {doc && doc.files && doc.files.length > 1 ? "copies" : "copy"} (PDF) before submitting.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Digital sign panel ── */}
                  {signMode === "digital" && (
                  <>
                  {/* Signing Credentials */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <button onClick={() => setCredOpen(v => !v)}
                      className="w-full flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-foreground hover:bg-accent/50 transition">
                      <Settings2 className="w-4 h-4 text-primary" />
                      <span>Signing Credentials</span>
                      {p12File && <span className="ml-2 text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">P12 loaded</span>}
                      <span className="ml-auto text-[10px] bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">Local only</span>
                      <span className="text-muted-foreground ml-2">{credOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                    </button>
                    {credOpen && (
                      <div className="border-t border-border px-5 py-4 flex flex-col gap-4">

                        {/* P12 file */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">P12 / PFX Certificate <span className="text-destructive">*</span></label>
                          <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition">
                            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">
                              {p12FileName
                                ? <span className="text-foreground">{p12FileName}</span>
                                : <span className="text-muted-foreground">Click to select .p12 / .pfx — auto-saved for next time</span>}
                            </span>
                            <input type="file" accept=".p12,.pfx" className="hidden" onChange={handleP12Change} />
                          </label>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">P12 Password <span className="text-destructive">*</span></label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your P12 password"
                            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                        </div>

                        {/* Name + Position */}
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Display Name</label>
                            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                              placeholder={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`}
                              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Position / Title</label>
                            <input value={sigPos} onChange={e => setSigPos(e.target.value)}
                              placeholder={user?.position ?? "Your position"}
                              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                          </div>
                        </div>

                        {/* Signature image */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">Signature Image <span className="text-muted-foreground font-normal">(optional — auto-saved)</span></label>
                          <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition">
                            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground truncate">
                              {signImage ? signImage.name : signImagePreview ? "signature.png (saved)" : "Click to upload PNG/JPG"}
                            </span>
                            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
                          </label>
                          {signImagePreview && (
                            <img src={signImagePreview} alt="sig preview" className="mt-1 h-12 object-contain border border-border rounded-lg bg-white p-1" />
                          )}
                        </div>

                        {/* Text size slider */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center">
                            Text Size
                            <span className="ml-auto font-mono bg-accent px-2 py-0.5 rounded text-xs">{textSize} pt</span>
                          </label>
                          <input type="range" min={8} max={24} value={textSize} onChange={e => setTextSize(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        {/* Image width slider */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center">
                            Signature Image Width
                            <span className="ml-auto font-mono bg-accent px-2 py-0.5 rounded text-xs">{imgWidth} px</span>
                          </label>
                          <input type="range" min={50} max={300} step={10} value={imgWidth} onChange={e => setImgWidth(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        {/* Stamp box size */}
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center">
                              Stamp Width
                              <span className="ml-auto font-mono bg-accent px-2 py-0.5 rounded text-xs">{sigBoxW} pt</span>
                            </label>
                            <input
                              type="range"
                              min={140}
                              max={420}
                              step={10}
                              value={sigBoxW}
                              onChange={e => {
                                const next = Number(e.target.value);
                                setSigBoxW(next);
                                localStorage.setItem("sig_stamp_width", String(next));
                              }}
                              className="w-full accent-primary"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center">
                              Stamp Height
                              <span className="ml-auto font-mono bg-accent px-2 py-0.5 rounded text-xs">{sigBoxH} pt</span>
                            </label>
                            <input
                              type="range"
                              min={50}
                              max={220}
                              step={5}
                              value={sigBoxH}
                              onChange={e => {
                                const next = Number(e.target.value);
                                setSigBoxH(next);
                                localStorage.setItem("sig_stamp_height", String(next));
                              }}
                              className="w-full accent-primary"
                            />
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Error banner */}
                  {error && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  {/* Remarks for signing */}
                  {mySig && mySig.status === "pending" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={signRemarks}
                        onChange={e => setSignRemarks(e.target.value)}
                        placeholder="Add a note about your signature..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition"
                      />
                    </div>
                  )}

                  {/* Sign / Decline buttons */}
                  <div className="flex gap-2">
                    {mySig && mySig.status === "pending" && (
                      <button onClick={() => setDeclineOpen(true)} disabled={signing}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-destructive/60 text-destructive text-sm font-semibold hover:bg-destructive/10 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <XCircle className="w-4 h-4" /> Decline
                      </button>
                    )}
                  <button onClick={handleSign} disabled={signing || Object.values(fileStampsState).every(c => !c.placed)}
                      title={Object.values(fileStampsState).every(c => !c.placed) ? "Place your signature on at least one document file first" : undefined}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {signing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing document...</>
                        : <><Key className="w-4 h-4" /> Sign with PNPKI</>}
                    </button>
                  </div>
                  {Object.values(fileStampsState).every(c => !c.placed) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                      ⚠ Click <strong>Place Signature</strong> on the document viewer to position your stamp before signing.
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">
                    Your P12 certificate and password are used only in your browser and are never sent to our server.
                  </p>
                  </>
                  )}{/* end digital panel */}

                </div>
              )}

              {/* ── Not a signatory and not owner ───────────────── */}
              {!canSign && !error && doc && !loading && (
                <div className="bg-accent/40 border border-border rounded-xl px-5 py-4 text-sm text-muted-foreground">
                  You are not assigned as a signatory for this document.
                </div>
              )}
              {error && !canSign && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                </div>
              )}

            </div>{/* end LEFT column */}

        
          </div>
        )}
      </div>

      {/* ── Decline modal ──────────────────────────────────────────────────── */}
      {declineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Decline to Sign</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Please provide a reason so the sender understands why the document was declined.
                </p>
              </div>
            </div>

            {/* Document summary */}
            <div className="bg-accent/50 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-foreground truncate">{doc?.title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc?.tracknumber}</p>
            </div>

            <textarea
              rows={4}
              placeholder="Reason for declining (optional but recommended)..."
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40 resize-none transition"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setDeclineOpen(false); setDeclineReason(""); }}
                disabled={declining}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
                {declining
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Declining...</>
                  : <><XCircle className="w-4 h-4" /> Confirm Decline</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default SignDocument;
