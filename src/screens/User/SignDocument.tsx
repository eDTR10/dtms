import { useEffect, useState, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).href;
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText, CheckCircle2, Key, Upload, AlertTriangle, Download,
  Eye, MousePointer2,  Loader2, ChevronDown, ChevronUp, XCircle, ShieldOff,
  ChevronLeft, ChevronRight, PenLine, Printer, UserPlus, X, Plus, Save, Users, Link2, Link2Off,
  Layers, LayoutGrid, ZoomIn, ZoomOut
} from "lucide-react";
import UserLayout from "./UserLayout";
import { documentApi, signatoryApi, userApi, Document, DocumentSignatory, DocumentFile, SignatoryUser } from "../../services/api";
import { useAuth } from "../Auth/AuthContext";
import DocumentFileList from "../../components/DocumentFileList";
import SigningOverlay from "@/components/ui/scannerLoader";
import { buildStampBlob } from "./stampUtils";
import {
  SignatureProfile,
  ensureSignatureProfiles,
  setActiveSignatureProfileId,
  syncLegacyStorageFromProfile,
} from "./signatureProfiles";

/** Safely parse a datetime string from the API as UTC. */
const parseUTC = (str: string): Date =>
  new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(str) ? str : str + "Z");

/** Format a signed_at string for display */
const fmtSignedAt = (str: string) =>
  parseUTC(str).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const PDF_W = 595, PDF_H = 842;

const base64ToFile = (b64: string, filename: string, mime: string): File => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};



const PNPKI_URL = (import.meta.env.VITE_PNPKI_SERVER as string || "").replace(/\/$/, "");
const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string || "").replace(/\/$/, "");

const ROUTING_PAGE_SIZE = 6;
const MAX_UPLOAD_FILE_SIZE = 12 * 1024 * 1024; // 12MB

type SigningProgressState = {
  total: number;
  completed: number;
  success: number;
  failed: number;
  currentLabel: string;
};

type StampStyleSnapshot = {
  signatureProfileId: string;
  displayName: string;
  sigPos: string;
  showSignedBy: boolean;
  signImagePreview: string;
  imgTop: number;
  imgLeft: number;
  imgWidthPct: number;
  txtTop: number;
  txtLeft: number;
  textSizePct: number;
  fontFamily: string;
  isItalic: boolean;
  isBold: boolean;
  nameColor: string;
  positionColor: string;
  signedByColor: string;
};

const getManualUploadSizeError = (file: File): string | null => {
  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    return `"${file.name}" exceeds the 12MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
//  STAMP PREVIEW COMPONENT
//  Matches the Signature Settings designer exactly: image and text are
//  positioned using % values from localStorage (imgTop/imgLeft/txtTop/txtLeft).
// ─────────────────────────────────────────────────────────────────────────────
interface StampPreviewProps {
  cssW: number;
  cssH: number;
  signImagePreview: string;
  displayName: string;
  sigPos: string;
  showSignedBy: boolean;
  fallbackName: string;
  imgTop: number;
  imgLeft: number;
  imgWidthPct: number;
  txtTop: number;
  txtLeft: number;
  textSizePct: number; // 0–100
  fontFamily?: string;
  isItalic?: boolean;
  isBold?: boolean;
  nameColor?: string;
  positionColor?: string;
  signedByColor?: string;
}

const StampPreview = ({
  cssW, cssH,
  signImagePreview,
  displayName,
  sigPos,
  showSignedBy,
  fallbackName,
  imgTop, imgLeft, imgWidthPct,
  txtTop, txtLeft, textSizePct,
  fontFamily = "Inter, sans-serif",
  isItalic = false,
  isBold = true,
  nameColor = "#1e3a5f",
  positionColor = "#2563EB",
  signedByColor = "#64748b",
}: StampPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Mirror stampUtils._draw exactly so preview == output
    const tsp        = textSizePct / 100;
    const nameFs     = Math.max(0.01, tsp         * H);
    const posFs      = Math.max(0.01, tsp * 0.833 * H);
    const signedByFs = Math.max(0.01, tsp * 0.667 * H);

    const nameToRender = displayName || fallbackName;
    const nameLines = nameToRender
      ? nameToRender
          .split(/<br\s*\/?>(?![^<]*>)/i)
          .map(l => l.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim())
          .filter(Boolean)
      : [];

    const drawText = () => {
      const tx = (txtLeft / 100) * W;
      const ty = (txtTop  / 100) * H;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";

      let nameY = ty;
      if (showSignedBy) {
        ctx.font      = `${isItalic ? "italic " : ""}${signedByFs}px ${fontFamily}`;
        ctx.fillStyle = signedByColor;
        ctx.fillText("Digitally Signed by:", tx, ty);
        nameY = ty + signedByFs * 1.4;
      }

      if (nameLines.length) {
        ctx.font      = `${isItalic ? "italic " : ""}${isBold ? "bold " : ""}${nameFs}px ${fontFamily}`;
        ctx.fillStyle = nameColor;
        nameLines.forEach((line, i) => {
          ctx.fillText(line, tx, nameY + i * nameFs * 1.3);
        });
      }

      if (sigPos) {
        ctx.font      = `${isItalic ? "italic " : ""}${posFs}px ${fontFamily}`;
        ctx.fillStyle = positionColor;
        ctx.fillText(sigPos, tx, nameY + nameLines.length * nameFs * 1.3);
      }
    };

    if (signImagePreview) {
      const img = new Image();
      img.onload = () => {
        const iw = (imgWidthPct / 100) * W;
        const ih = img.naturalHeight * (iw / Math.max(1, img.naturalWidth));
        const ix = (imgLeft / 100) * W - iw / 2;
        const iy = (imgTop  / 100) * H;
        ctx.drawImage(img, ix, iy, iw, ih);
        drawText();
      };
      img.onerror = () => drawText();
      img.src = signImagePreview;
    } else {
      drawText();
    }
  }, [cssW, cssH, signImagePreview, displayName, sigPos, showSignedBy,
      fallbackName, imgTop, imgLeft, imgWidthPct, txtTop, txtLeft, textSizePct,
      fontFamily, isItalic, isBold, nameColor, positionColor, signedByColor]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SignDocument = () => {
  const { tracknumber } = useParams<{ tracknumber: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams] = useSearchParams();
  const tracksParam = searchParams.get("tracks");
  const tracksArray = tracksParam ? tracksParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const isBatchMode = tracknumber === "batch" && tracksArray.length > 0;
  const primaryTrack = isBatchMode ? tracksArray[0] : tracknumber;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedBlobs, setSignedBlobs] = useState<Array<{ blob: Blob; name: string }>>([]);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [signingProgress, setSigningProgress] = useState<SigningProgressState | null>(null);
  const [signingFailures, setSigningFailures] = useState<string[]>([]);
  const [signatureProfiles, setSignatureProfiles] = useState<SignatureProfile[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState("");

  // ── Per-file stamp tracking ───────────────────────────────────────────────
  type FileStampConfig = {
    sigX: number; sigY: number; sigPage: number;
    sigBoxW: number; sigBoxH: number;
    placed: boolean; pdfW: number; pdfH: number;
    style: StampStyleSnapshot;
  };

  const fileStampRef = useRef<Record<number, FileStampConfig>>({})
  const [fileStampsState, setFileStampsState] = useState<Record<number, FileStampConfig>>({});
  const [activeDocFile, setActiveDocFile] = useState<DocumentFile | null>(null);
  const [manualSignedFiles, setManualSignedFiles] = useState<Record<number, File>>({});

  const [pdfVisible, setPdfVisible] = useState(true);
  const [placingMode, setPlacingMode] = useState(false);
  const [hoverPx, setHoverPx] = useState<{ left: number; top: number } | null>(null);
  const [stampPlaced, setStampPlaced] = useState(false);

  // FIX #4: Store aspect ratio at resize start so we can lock it
  const draggingStamp = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizingStamp = useRef<{
    startX: number; startY: number;
    origW: number; origH: number; origX: number; origY: number;
    corner: "se" | "sw" | "ne" | "nw";
    aspectRatio: number; // FIX #4: locked ratio = origW / origH
  } | null>(null);

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 640);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null); // measures available width (zoom-independent)
  const viewerContainerRef = useRef<HTMLDivElement>(null); // matches canvas size for overlay positioning
  const renderTaskRef = useRef<any>(null);
  const pdfLoadSeqRef = useRef(0);
  const pdfBlobUrlRef = useRef<string | null>(null);
  const activeFileIdRef = useRef<number | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [renderScale, setRenderScale] = useState(1);
  const [pdfPageWidth, setPdfPageWidth] = useState(PDF_W);
  const [pdfPageHeight, setPdfPageHeight] = useState(PDF_H);

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const zoomLevelRef = useRef(1.0);
  const sigPageRef = useRef(1);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const renderPage = useCallback(async (doc: any, pageNum: number, zoom?: number) => {
    if (!canvasRef.current || !outerContainerRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch (_) { }
      renderTaskRef.current = null;
    }
    const page = await doc.getPage(pageNum);
    const vp1 = page.getViewport({ scale: 1 });
    // Always measure the *outer* container so zoom doesn't feedback-loop the width
    const cw = outerContainerRef.current.clientWidth || 600;
    const scale = (cw / vp1.width) * (zoom ?? zoomLevelRef.current);
    const vp = page.getViewport({ scale });
    const canvas = canvasRef.current;
    canvas.width = Math.floor(vp.width);
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

  const loadPdf = useCallback(async (fileUrl: string, opts?: { force?: boolean; fileId?: number | null; page?: number }) => {
    const loadSeq = ++pdfLoadSeqRef.current;
    const force = !!opts?.force;
    const targetFileId = typeof opts?.fileId === "number" ? opts.fileId : null;
    const requestedPage = typeof opts?.page === "number" ? opts.page : sigPageRef.current;
    if (pdfBlobUrlRef.current && !force) return;
    setPdfLoading(true);
    setPdfError(null);
    setPdfDoc(null);
    try {
      if (force && pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
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
      if (loadSeq !== pdfLoadSeqRef.current) return;
      if (targetFileId !== null && activeFileIdRef.current !== targetFileId) return;

      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      if (loadSeq !== pdfLoadSeqRef.current || (targetFileId !== null && activeFileIdRef.current !== targetFileId)) {
        URL.revokeObjectURL(url);
        return;
      }

      if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = url;
      setPdfBlobUrl(url);

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const nextDoc = await loadingTask.promise;
      if (loadSeq !== pdfLoadSeqRef.current || (targetFileId !== null && activeFileIdRef.current !== targetFileId)) {
        try { await nextDoc.destroy(); } catch (_) { }
        return;
      }

      const safePage = Math.max(1, Math.min(requestedPage, nextDoc.numPages));
      setPdfDoc(nextDoc);
      if (safePage !== sigPageRef.current) setSigPage(safePage);
      await renderPage(nextDoc, safePage);
    } catch (e: any) {
      if (loadSeq === pdfLoadSeqRef.current) {
        setPdfError(e?.message || "Failed to load PDF.");
      }
    } finally {
      if (loadSeq === pdfLoadSeqRef.current) setPdfLoading(false);
    }
  }, [renderPage]);

  useEffect(() => {
    return () => {
      pdfLoadSeqRef.current += 1;
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, []);

  // ── Credentials ───────────────────────────────────────────────────────────
  const [p12File, setP12File] = useState<File | null>(null);
  const [_p12FileName, setP12FileName] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sigPos, setSigPos] = useState("");
  const [_signImage, setSignImage] = useState<File | null>(null);
  const [signImagePreview, setSignImagePreview] = useState("");
  const [showSignedBy, setShowSignedBy] = useState(false);

  // ── Stamp layout settings (from Signature Settings designer) ─────────────
  const [imgTop,      setImgTop]      = useState(Number(localStorage.getItem("sig_img_top"))          || 5);
  const [imgLeft,     setImgLeft]     = useState(Number(localStorage.getItem("sig_img_left"))         || 50);
  const [imgWidthPct, setImgWidthPct] = useState(Number(localStorage.getItem("sig_image_width_pct")) || 35);
  const [txtTop,      setTxtTop]      = useState(Number(localStorage.getItem("sig_txt_top"))          || 55);
  const [txtLeft,     setTxtLeft]     = useState(Number(localStorage.getItem("sig_txt_left"))         || 50);
  const [textSizePct, setTextSizePct] = useState(Number(localStorage.getItem("sig_text_size_pct"))   || 18);

  // ── Font style + colors (from Signature Settings) ─────────────────────────
  const [fontFamily,    _setFontFamily]    = useState(localStorage.getItem("sig_font_family")      || "Inter, sans-serif");
  const [isItalic,      _setIsItalic]      = useState(localStorage.getItem("sig_is_italic") === "true");
  const [isBold,        _setIsBold]        = useState(localStorage.getItem("sig_is_bold") !== "false");
  const [nameColor,     _setNameColor]     = useState(localStorage.getItem("sig_name_color")       || "#1e3a5f");
  const [positionColor, _setPositionColor] = useState(localStorage.getItem("sig_pos_color")        || "#2563eb");
  const [signedByColor, _setSignedByColor] = useState(localStorage.getItem("sig_signed_by_color")  || "#64748b");

  // ── Stamp sizing ──────────────────────────────────────────────────────────
  const [sigX, setSigX] = useState(170);
  const [sigY, setSigY] = useState(720);
  const [sigBoxW, setSigBoxW] = useState(Number(localStorage.getItem("sig_stamp_width")) || 220);
  const [sigBoxH, setSigBoxH] = useState(Number(localStorage.getItem("sig_stamp_height")) || 80);
  const [sigPage, setSigPage] = useState(1);
  const [batchSignPage, setBatchSignPage] = useState(false);
  const [batchSignFile, setBatchSignFile] = useState(false);

  const captureStampStyle = useCallback((): StampStyleSnapshot => ({
    signatureProfileId: selectedSignatureId,
    displayName,
    sigPos,
    showSignedBy,
    signImagePreview,
    imgTop,
    imgLeft,
    imgWidthPct,
    txtTop,
    txtLeft,
    textSizePct,
    fontFamily,
    isItalic,
    isBold,
    nameColor,
    positionColor,
    signedByColor,
  }), [
    selectedSignatureId,
    displayName,
    sigPos,
    showSignedBy,
    signImagePreview,
    imgTop,
    imgLeft,
    imgWidthPct,
    txtTop,
    txtLeft,
    textSizePct,
    fontFamily,
    isItalic,
    isBold,
    nameColor,
    positionColor,
    signedByColor,
  ]);

  const applyStampStyle = useCallback((style: StampStyleSnapshot) => {
    setSelectedSignatureId(style.signatureProfileId || "");
    setDisplayName(style.displayName || "");
    setSigPos(style.sigPos || "");
    setShowSignedBy(!!style.showSignedBy);
    setImgTop(style.imgTop || 5);
    setImgLeft(style.imgLeft || 50);
    setImgWidthPct(style.imgWidthPct || 35);
    setTxtTop(style.txtTop || 55);
    setTxtLeft(style.txtLeft || 50);
    setTextSizePct(style.textSizePct || 18);
    _setFontFamily(style.fontFamily || "Inter, sans-serif");
    _setIsItalic(!!style.isItalic);
    _setIsBold(style.isBold !== false);
    _setNameColor(style.nameColor || "#1e3a5f");
    _setPositionColor(style.positionColor || "#2563eb");
    _setSignedByColor(style.signedByColor || "#64748b");

    if (style.signImagePreview) {
      setSignImagePreview(style.signImagePreview);
      try {
        const [hdr, b64] = style.signImagePreview.split(",");
        const mime = hdr?.match(/:(.*?);/)?.[1] || "image/png";
        setSignImage(base64ToFile(b64, "signature.png", mime));
      } catch {
        setSignImage(null);
      }
    } else {
      setSignImagePreview("");
      setSignImage(null);
    }
  }, []);

  const applySignatureProfile = useCallback((profile: SignatureProfile) => {
    setPassword(profile.password || "");
    setDisplayName(profile.displayName || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim());
    setSigPos(profile.position || user?.position || "");
    setSigBoxW(profile.stampWidth || 220);
    setSigBoxH(profile.stampHeight || 80);
    setShowSignedBy(!!profile.showSignedBy);
    setImgTop(profile.imgTop || 5);
    setImgLeft(profile.imgLeft || 50);
    setImgWidthPct(profile.imgWidthPct || 35);
    setTxtTop(profile.txtTop || 55);
    setTxtLeft(profile.txtLeft || 50);
    setTextSizePct(profile.textSizePct || 18);
    _setFontFamily(profile.fontFamily || "Inter, sans-serif");
    _setIsItalic(!!profile.isItalic);
    _setIsBold(profile.isBold !== false);
    _setNameColor(profile.nameColor || "#1e3a5f");
    _setPositionColor(profile.positionColor || "#2563eb");
    _setSignedByColor(profile.signedByColor || "#64748b");

    if (profile.p12Data) {
      try {
        const filename = profile.p12Name || "certificate.p12";
        setP12File(base64ToFile(profile.p12Data, filename, "application/x-pkcs12"));
        setP12FileName(filename);
      } catch {
        setP12File(null);
        setP12FileName("");
      }
    } else {
      setP12File(null);
      setP12FileName("");
    }

    if (profile.signImageData) {
      setSignImagePreview(profile.signImageData);
      try {
        const [hdr, b64] = profile.signImageData.split(",");
        const mime = hdr?.match(/:(.*?);/)?.[1] || "image/png";
        setSignImage(base64ToFile(b64, "signature.png", mime));
      } catch {
        setSignImage(null);
      }
    } else {
      setSignImagePreview("");
      setSignImage(null);
    }

    syncLegacyStorageFromProfile(profile);
  }, [user?.first_name, user?.last_name, user?.position]);

  const handleSignatureProfileSelect = (profileId: string) => {
    setSelectedSignatureId(profileId);
    setActiveSignatureProfileId(profileId);
    const profile = signatureProfiles.find(p => p.id === profileId);
    if (!profile) return;
    applySignatureProfile(profile);
  };

  useEffect(() => {
    sigPageRef.current = sigPage;
  }, [sigPage]);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, sigPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigPage, pdfDoc]);

  // ── Global pointer handlers for drag / resize ─────────────────────────────
  // FIX #4: aspect ratio is locked — width drives height via stored ratio
  useEffect(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // FIX #1: absolute minimums lowered to 20×10 so tiny counter-sigs are possible
    const MIN_W = 10;
    const MIN_H = 5;

    const onMove = (clientX: number, clientY: number) => {
      if (draggingStamp.current) {
        const { startX, startY, origX, origY } = draggingStamp.current;
        const dx = (clientX - startX) / renderScale;
        const dy = (clientY - startY) / renderScale;
        setSigX(clamp(origX + dx, 0, pdfPageWidth - sigBoxW));
        setSigY(clamp(origY - dy, 0, pdfPageHeight - sigBoxH));
      }
      if (resizingStamp.current) {
        const { startX, startY: _startY, origW, origH, origX, origY, corner, aspectRatio } = resizingStamp.current;
        const dw = (clientX - startX) / renderScale;

        // FIX #4: derive height from new width to keep ratio locked
        if (corner === "se") {
          const newW = clamp(origW + dw, MIN_W, pdfPageWidth);
          const newH = clamp(newW / aspectRatio, MIN_H, pdfPageHeight);
          setSigBoxW(Math.round(newW));
          setSigBoxH(Math.round(newH));
          setSigY(clamp(origY - (newH - origH), 0, pdfPageHeight - MIN_H));
        } else if (corner === "sw") {
          const newW = clamp(origW - dw, MIN_W, pdfPageWidth);
          const newH = clamp(newW / aspectRatio, MIN_H, pdfPageHeight);
          setSigBoxW(Math.round(newW));
          setSigBoxH(Math.round(newH));
          setSigX(clamp(origX + dw, 0, pdfPageWidth - MIN_W));
          setSigY(clamp(origY - (newH - origH), 0, pdfPageHeight - MIN_H));
        } else if (corner === "ne") {
          const newW = clamp(origW + dw, MIN_W, pdfPageWidth);
          const newH = clamp(newW / aspectRatio, MIN_H, pdfPageHeight);
          setSigBoxW(Math.round(newW));
          setSigBoxH(Math.round(newH));
        } else if (corner === "nw") {
          const newW = clamp(origW - dw, MIN_W, pdfPageWidth);
          const newH = clamp(newW / aspectRatio, MIN_H, pdfPageHeight);
          setSigBoxW(Math.round(newW));
          setSigBoxH(Math.round(newH));
          setSigX(clamp(origX + dw, 0, pdfPageWidth - MIN_W));
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingStamp.current && !resizingStamp.current) return;
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onUp = () => {
      draggingStamp.current = null;
      resizingStamp.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderScale, pdfPageWidth, pdfPageHeight, sigBoxW, sigBoxH]);

  useEffect(() => {
    setSigX(prev => Math.max(0, Math.min(prev, pdfPageWidth - sigBoxW)));
    setSigY(prev => Math.max(0, Math.min(prev, pdfPageHeight - sigBoxH)));
  }, [pdfPageWidth, pdfPageHeight, sigBoxW, sigBoxH]);

  const mySig: DocumentSignatory | undefined = doc?.signatories.find(s => s.user_id === user?.id);
  const isOwner = doc?.userID === user?.id;
  const isViewer = mySig?.role === "viewer";
  const canSign = !!doc && !isViewer && (isOwner || mySig?.status === "pending" || mySig?.status === "signed");
  const canPlaceSignature = canSign && !!pdfDoc && !pdfLoading && !!selectedFileUrl;

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [signRemarks, setSignRemarks] = useState("");
  const [viewerComment, setViewerComment] = useState("");
  const [viewerCommentSaving, setViewerCommentSaving] = useState(false);
  const [viewerCommentSaved, setViewerCommentSaved] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [signMode, setSignMode] = useState<"digital" | "manual">("digital");
  const [manualUploading, setManualUploading] = useState(false);
  const [manualDragging, setManualDragging] = useState(false);

  const [editingRouting, setEditingRouting] = useState(false);
  const [routingSignatories, setRoutingSignatories] = useState<Array<{
    user_id: number; user_email: string; user_name: string; order: number; status?: string; role?: "signer" | "viewer";
  }>>([]);
  const [routingUsers, setRoutingUsers] = useState<SignatoryUser[]>([]);
  const [routingSearch, setRoutingSearch] = useState("");
  const [routingPage, setRoutingPage] = useState(0);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [draggedSigIdx, setDraggedSigIdx] = useState<number | null>(null);

  const normalizeRoutingOrders = (entries: typeof routingSignatories) => {
    const normalized: typeof routingSignatories = [];
    let currentOrder = 0;
    for (let i = 0; i < entries.length; i++) {
      const orderVal = typeof entries[i].order === "number" ? entries[i].order : 0;
      if (i > 0 && orderVal !== (typeof entries[i - 1].order === "number" ? entries[i - 1].order : 0)) currentOrder += 1;
      normalized.push({ ...entries[i], order: currentOrder });
    }
    return normalized;
  };

  const toggleParallel = (index: number) => {
    setRoutingSignatories(prev => {
      const updated = prev.map(s => ({ ...s }));
      const above = updated[index - 1];
      const current = updated[index];
      if (above.status === "signed" || above.status === "rejected") return prev;
      if (current.order === above.order) {
        const threshold = current.order;
        for (let j = index; j < updated.length; j++) {
          if (updated[j].order >= threshold) updated[j].order += 1;
        }
      } else {
        current.order = above.order;
      }
      return normalizeRoutingOrders(updated);
    });
  };

  const moveRoutingSignatory = (index: number, direction: "up" | "down") => {
    setRoutingSignatories(prev => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      if (prev[targetIndex].status === "signed" || prev[targetIndex].status === "rejected") return prev;
      const updated = prev.map(s => ({ ...s }));
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return normalizeRoutingOrders(updated);
    });
  };

  const handleSigDragStart = (idx: number) => setDraggedSigIdx(idx);
  const handleSigDragOver = (idx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedSigIdx === null || draggedSigIdx === idx) return;
    const draggedItem = routingSignatories[draggedSigIdx];
    const targetItem = routingSignatories[idx];
    if (draggedItem.status === "signed" || draggedItem.status === "rejected" || targetItem.status === "signed" || targetItem.status === "rejected") return;
    setRoutingSignatories(prev => {
      const arr = [...prev];
      const [dragged] = arr.splice(draggedSigIdx, 1);
      arr.splice(idx, 0, dragged);
      return arr;
    });
    setDraggedSigIdx(idx);
  };
  const handleSigDragEnd = () => setDraggedSigIdx(null);

  const openRoutingEditor = () => {
    if (!doc) return;
    setRoutingSignatories(
      [...doc.signatories].sort((a, b) => a.order - b.order).map(s => ({
        user_id: s.user_id, user_email: s.user_email, user_name: s.user_name, order: s.order, status: s.status, role: s.role,
      }))
    );
    setEditingRouting(true);
    userApi.signatories().then(setRoutingUsers);
  };

  const filteredRoutingUsers = routingUsers.filter(u => {
    if (routingSignatories.some(s => s.user_id === u.id)) return false;
    const q = routingSearch.toLowerCase();
    if (!q) return true;
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.position.toLowerCase().includes(q) ||
      (u.office_name || "").toLowerCase().includes(q)
    );
  });
  const totalRoutingPages = Math.ceil(filteredRoutingUsers.length / ROUTING_PAGE_SIZE);
  const pagedRoutingUsers = filteredRoutingUsers.slice(routingPage * ROUTING_PAGE_SIZE, (routingPage + 1) * ROUTING_PAGE_SIZE);

  const handleSaveRouting = async () => {
    if (!doc) return;
    setRoutingSaving(true);
    try {
      const updated = await documentApi.updateRouting(doc.id, { signatories: routingSignatories });
      setDoc(updated); setEditingRouting(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to update routing.");
    } finally {
      setRoutingSaving(false);
    }
  };

  const handleDecline = async () => {
    if (!mySig) return;
    setDeclining(true);
    try {
      await signatoryApi.update(mySig.id, { status: "rejected", remarks: declineReason });
      setDeclineOpen(false);
      const updated = await documentApi.getByTrack(doc!.tracknumber);
      setDoc(updated);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to decline. Please try again.");
      setDeclineOpen(false);
    } finally {
      setDeclining(false);
    }
  };

  // Load selected signature profile
  useEffect(() => {
    const { profiles, activeId } = ensureSignatureProfiles();
    setSignatureProfiles(profiles);
    const selected = profiles.find(p => p.id === activeId) || profiles[0];
    if (!selected) return;
    setSelectedSignatureId(selected.id);
    applySignatureProfile(selected);
  }, [applySignatureProfile]);

  useEffect(() => {
    if (!primaryTrack) return;
    const controller = new AbortController();
    documentApi.getByTrack(primaryTrack, controller.signal)
      .then(d => {
        setDoc(d);
        const firstFile = d.files && d.files.length > 0 ? d.files[0] : null;
        const fileToLoad = firstFile?.file_url || d.file_url || null;
        setSelectedFileUrl(fileToLoad);
        if (firstFile) {
          activeFileIdRef.current = firstFile.id;
          setActiveDocFile(firstFile);
        } else {
          activeFileIdRef.current = null;
          setActiveDocFile(null);
        }
        if (fileToLoad && pdfVisible) loadPdf(fileToLoad, { force: true, fileId: firstFile?.id ?? null, page: 1 });
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        const httpStatus = err?.response?.status;
        if (httpStatus === 403) setError("unauthorized");
        else if (httpStatus === 404) setError("Document not found.");
        else setError("Failed to load document.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryTrack]);

  // ── Overlay event handler ─────────────────────────────────────────────────
  const handleOverlayEvent = (e: React.MouseEvent<HTMLDivElement>, isClick: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sc = renderScale;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const sw = sigBoxW * sc;
    const sh = sigBoxH * sc;
    const left = Math.max(0, Math.min(rect.width - sw, px - sw / 2));
    const top = Math.max(0, Math.min(rect.height - sh, py - sh / 2));
    if (isClick) {
      const newX = Math.max(0, Math.min(pdfPageWidth - sigBoxW, px / sc - sigBoxW / 2));
      const newY = Math.max(0, Math.min(pdfPageHeight - sigBoxH, pdfPageHeight - py / sc - sigBoxH / 2));
      setSigX(newX);
      setSigY(newY);
      setStampPlaced(true);
      setPlacingMode(false);
      setHoverPx(null);
      if (activeDocFile) {
        const cfg: FileStampConfig = {
          sigX: newX, sigY: newY, sigPage, sigBoxW, sigBoxH,
          placed: true, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
          style: captureStampStyle(),
        };
        fileStampRef.current[activeDocFile.id] = cfg;
        setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
      }
    } else {
      setHoverPx({ left, top });
    }
  };

  const switchToFile = (newFile: DocumentFile) => {
    if (activeDocFile) {
      const cfg: FileStampConfig = {
        sigX, sigY, sigPage, sigBoxW, sigBoxH,
        placed: stampPlaced, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
        style: captureStampStyle(),
      };
      fileStampRef.current[activeDocFile.id] = cfg;
      setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
    }
    const saved = fileStampRef.current[newFile.id];
    if (saved) {
      setSigX(saved.sigX); setSigY(saved.sigY); setSigPage(saved.sigPage);
      setSigBoxW(saved.sigBoxW); setSigBoxH(saved.sigBoxH); setStampPlaced(saved.placed);
      applyStampStyle(saved.style);
    } else {
      setSigX(170); setSigY(720); setSigPage(1); setStampPlaced(false);
      // No saved config — restore to regular stamp dims
      setSigBoxW(Number(localStorage.getItem("sig_stamp_width")) || 220);
      setSigBoxH(Number(localStorage.getItem("sig_stamp_height")) || 80);
    }
    setPlacingMode(false); setHoverPx(null);
    activeFileIdRef.current = newFile.id;
    setActiveDocFile(newFile);
    setSelectedFileUrl(newFile.file_url);
    setPdfVisible(true);
    loadPdf(newFile.file_url, { force: true, fileId: newFile.id, page: saved?.sigPage || 1 });
  };




  // ── Build composite stamp blob for backend using shared stampUtils ─────────
  const buildStampCanvas = (style?: StampStyleSnapshot, dims?: { width: number; height: number }): Promise<Blob | null> => {
    // For tiny stamps (counter-sign), increase renderScale so the canvas is
    // drawn at full quality (~320px tall).  The AP matrix from pyhanko will
    // uniformly scale it down to the actual field size — aspect ratio is
    // always preserved because cW was computed from cH * (stampW/stampH).
    const normalStampH = Number(localStorage.getItem("sig_stamp_height")) || 80;
    const targetW = dims?.width ?? sigBoxW;
    const targetH = dims?.height ?? sigBoxH;
    const styleToUse = style || captureStampStyle();
    const qualityScale = Math.max(8, Math.ceil((normalStampH * 8) / targetH));
    return buildStampBlob({
      signImagePreview: styleToUse.signImagePreview || null,
      imgTop: styleToUse.imgTop,
      imgLeft: styleToUse.imgLeft,
      imgWidthPct: styleToUse.imgWidthPct,
      txtTop: styleToUse.txtTop,
      txtLeft: styleToUse.txtLeft,
      showSignedBy: styleToUse.showSignedBy,
      displayName: styleToUse.displayName || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
      position: styleToUse.sigPos,
      textSizePct: styleToUse.textSizePct / 100,
      stampWidthPt:  targetW,
      stampHeightPt: targetH,
      renderScale: qualityScale,
      fontFamily: styleToUse.fontFamily,
      isItalic: styleToUse.isItalic,
      isBold: styleToUse.isBold,
      nameColor: styleToUse.nameColor,
      positionColor: styleToUse.positionColor,
      signedByColor: styleToUse.signedByColor,
    });
  };

  // ── Sign handler ──────────────────────────────────────────────────────────
  const handleSign = async () => {
    if (!doc) return;
    if (!p12File) { setError("Please select your P12/PFX certificate file."); return; }
    if (!password) { setError("Please enter your P12 password."); return; }
    if (!PNPKI_URL) { setError("PNPKI server URL is not configured."); return; }

    if (activeDocFile) {
      const cfg: FileStampConfig = {
        sigX, sigY, sigPage, sigBoxW, sigBoxH,
        placed: stampPlaced, pdfW: pdfPageWidth, pdfH: pdfPageHeight,
        style: captureStampStyle(),
      };
      fileStampRef.current[activeDocFile.id] = cfg;
      setFileStampsState(prev => ({ ...prev, [activeDocFile.id]: cfg }));
    }

    const allDocFiles = doc.files || [];
    let filesToSign = allDocFiles.filter(f => fileStampRef.current[f.id]?.placed);

    if ((batchSignFile || isBatchMode) && activeDocFile && stampPlaced) {
      filesToSign = allDocFiles;
      const activeCfg = fileStampRef.current[activeDocFile.id];
      allDocFiles.forEach(f => { fileStampRef.current[f.id] = activeCfg; });
    }

    if (filesToSign.length === 0) { setError("Place your signature on at least one document file first."); return; }

    setSigning(true); setError(null);
    setSigningFailures([]);
    setSigningProgress({
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      currentLabel: "Preparing files...",
    });
    const collected: Array<{ blob: Blob; name: string }> = [];
    try {
      const tok = localStorage.getItem("auth_token");
      const tracksToProcess = isBatchMode ? tracksArray : [doc.tracknumber];
      const runFailures: string[] = [];

      let totalPlanned = 0;
      let totalCompleted = 0;
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const trackNum of tracksToProcess) {
        setBatchProgress(trackNum);
        let currentDoc = doc;
        if (trackNum !== doc.tracknumber) {
          try { currentDoc = await documentApi.getByTrack(trackNum); }
          catch (e) {
            totalFailed += 1;
            totalCompleted += 1;
            totalPlanned += 1;
            runFailures.push(`[${trackNum}] Failed to load document details.`);
            setSigningProgress({
              total: totalPlanned,
              completed: totalCompleted,
              success: totalSuccess,
              failed: totalFailed,
              currentLabel: `Skipping ${trackNum} (load error)`,
            });
            continue;
          }
        }
        if (!currentDoc || !currentDoc.files) continue;

        let curFilesToSign = currentDoc.files.filter(f => fileStampRef.current[f.id]?.placed);
        if ((isBatchMode || batchSignFile) && activeDocFile && stampPlaced) curFilesToSign = currentDoc.files;
        if (curFilesToSign.length === 0) continue;

        totalPlanned += curFilesToSign.length;
        setSigningProgress({
          total: totalPlanned,
          completed: totalCompleted,
          success: totalSuccess,
          failed: totalFailed,
          currentLabel: `Processing ${trackNum}...`,
        });

        let appendedCount = 0;

        for (let i = 0; i < curFilesToSign.length; i++) {
          const docFile = curFilesToSign[i];
          setSigningProgress({
            total: totalPlanned,
            completed: totalCompleted,
            success: totalSuccess,
            failed: totalFailed,
            currentLabel: `${trackNum} • file ${i + 1}/${curFilesToSign.length}`,
          });

          try {
            let cfg = fileStampRef.current[docFile.id];
            if ((isBatchMode || batchSignFile) && activeDocFile) cfg = fileStampRef.current[activeDocFile.id];
            if (!cfg) throw new Error("No stamp placement found for this file.");

            const res = await fetch(docFile.file_url, { headers: tok ? { Authorization: `Token ${tok}` } : {} });
            if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}).`);
            const pdfBlob = await res.blob();

            const xRatio = cfg.sigX / cfg.pdfW;
            const wRatio = cfg.sigBoxW / cfg.pdfW;
            const hRatio = cfg.sigBoxH / cfg.pdfH;
            const styleForFile = cfg.style || captureStampStyle();
            const compositeBlob = await buildStampCanvas(styleForFile, { width: cfg.sigBoxW, height: cfg.sigBoxH });
            // Server expects y_ratio from the TOP of the page (top-origin).
            // cfg.sigY is bottom-origin (PDF convention), so convert:
            //   top_of_box_from_top = pdfH - sigY - sigBoxH
            const yRatio = (cfg.pdfH - cfg.sigY - cfg.sigBoxH) / cfg.pdfH;

            const fd = new FormData();
            fd.append("pdf_file", pdfBlob, `${trackNum}-${i}.pdf`);
            fd.append("p12_file", p12File, p12File.name);
            fd.append("password", password);
            // Always send signer_name / sign_note — the PNPKI server uses them
            // for PDF certificate metadata (not the visual stamp).  Visual stamp
            // appearance is controlled entirely by the sign_design PNG.
            fd.append("signer_name", styleForFile.displayName || `${user?.first_name} ${user?.last_name}`);
            fd.append("sign_note",   styleForFile.sigPos || user?.position || "");
            fd.append("page", String(cfg.sigPage));
            fd.append("sign_all_pages", batchSignPage ? "true" : "false");
            fd.append("x_ratio", String(xRatio));
            fd.append("y_ratio", String(yRatio));
            fd.append("w_ratio", String(wRatio));
            fd.append("h_ratio", String(hRatio));
            if (compositeBlob) fd.append("sign_design", new File([compositeBlob], "sign-design.png", { type: "image/png" }));
            if (styleForFile.signImagePreview) {
              try {
                const [hdr, b64] = styleForFile.signImagePreview.split(",");
                const mime = hdr?.match(/:(.*?);/)?.[1] || "image/png";
                fd.append("sign_image", base64ToFile(b64, "signature.png", mime), "signature.png");
              } catch {
                // Ignore malformed preview payload and continue signing.
              }
            }

            const signRes = await fetch(`${PNPKI_URL}/sign-pdf`, { method: "POST", body: fd });
            if (!signRes.ok) throw new Error(`PNPKI sign failed (HTTP ${signRes.status}).`);

            const signedPdfBlob = await signRes.blob();
            const signedName = `${trackNum}-signed-${i + 1}.pdf`;
            collected.push({ blob: signedPdfBlob, name: signedName });

            // Upload this single signed file immediately (one request per file to avoid 413)
            const uploadFd = new FormData();
            uploadFd.append("file_0", signedPdfBlob, signedName);
            uploadFd.append("file_id_0", String(docFile.id));
            const uploadRes = await fetch(`${SERVER_URL}/document/${currentDoc.id}/sign_files/`, {
              method: "PATCH", headers: tok ? { Authorization: `Token ${tok}` } : {}, body: uploadFd,
            });
            if (!uploadRes.ok) throw new Error(`Upload failed (HTTP ${uploadRes.status}).`);

            appendedCount++;
            totalSuccess++;
          } catch (fileErr: any) {
            totalFailed++;
            runFailures.push(`[${trackNum}] File ${i + 1}: ${fileErr?.message || "Unknown signing error."}`);
          } finally {
            totalCompleted++;
            setSigningProgress({
              total: totalPlanned,
              completed: totalCompleted,
              success: totalSuccess,
              failed: totalFailed,
              currentLabel: `${trackNum} • file ${i + 1}/${curFilesToSign.length}`,
            });
          }
        }

        const signedAnyForTrack = appendedCount > 0;
        if (signedAnyForTrack) {
          try {
            // Refresh the document to get fresh signatories after file uploads
            const freshDoc = await documentApi.getByTrack(trackNum);
            const curSig = freshDoc.signatories?.find(s => s.user_id === user?.id && String(s.status).toLowerCase() === "pending");
            if (curSig) {
              await signatoryApi.update(curSig.id, { status: "signed", remarks: signRemarks });
            }
          } catch (e) { /* ignore */ }
        }
      }

      setSignedBlobs(collected);
      setSigningFailures(runFailures);
      setSigningProgress(null);
      setBatchProgress(null);

      if (totalSuccess === 0) {
        setError("No files were signed successfully. Please review the errors and try again.");
        return;
      }

      if (primaryTrack) {
        const updatedPrimaryDoc = await documentApi.getByTrack(primaryTrack);
        setDoc(updatedPrimaryDoc);
        // Refresh activeDocFile so "Add Another Signature" uses the new signed URL
        if (activeDocFile && updatedPrimaryDoc.files) {
          const freshFile = updatedPrimaryDoc.files.find((f: DocumentFile) => f.id === activeDocFile.id);
          if (freshFile) {
            activeFileIdRef.current = freshFile.id;
            setActiveDocFile(freshFile);
            setSelectedFileUrl(freshFile.file_url);
          }
        }
      }
      setDone(true);
    } catch (err: any) {
      setBatchProgress(null);
      setSigningProgress(null);
      setError(err?.message || "Signing failed. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = () => {
    if (!signedBlobs.length || !doc) return;
    for (const { blob, name } of signedBlobs) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadFiles = async () => {
    if (!doc) return;
    const filesToDownload = doc.files?.length ? doc.files : doc.file_url ? [{ file_url: doc.file_url, id: -1 }] : [];
    if (!filesToDownload.length) return;
    try {
      const tok = localStorage.getItem("auth_token");
      for (let i = 0; i < filesToDownload.length; i++) {
        const f = filesToDownload[i];
        if (!f.file_url) continue;
        const res = await fetch(f.file_url, { headers: tok ? { Authorization: `Token ${tok}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const lastPart = f.file_url.split("/").pop();
        a.download = lastPart ? lastPart.split("?")[0] : "";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        if (i < filesToDownload.length - 1) await new Promise(r => setTimeout(r, 350));
      }
    } catch (e: any) { setError(e?.message || "Failed to download file."); }
  };

  const handleManualSign = async () => {
    if (!doc) return;
    const entries = Object.entries(manualSignedFiles);
    if (entries.length === 0) return;
    const tooLargeFile = entries.find(([, file]) => file.size > MAX_UPLOAD_FILE_SIZE)?.[1];
    if (tooLargeFile) {
      setError(`"${tooLargeFile.name}" exceeds the 12MB limit (${(tooLargeFile.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    setManualUploading(true); setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const uploadFd = new FormData();
      entries.forEach(([fileId, file], i) => { uploadFd.append(`file_${i}`, file, file.name); uploadFd.append(`file_id_${i}`, fileId); });
      const uploadRes = await fetch(`${SERVER_URL}/document/${doc.id}/sign_files/`, {
        method: "PATCH", headers: token ? { Authorization: `Token ${token}` } : {}, body: uploadFd,
      });
      if (!uploadRes.ok) { const txt = await uploadRes.text(); throw new Error(`Upload failed: ${uploadRes.status} – ${txt}`); }
      const updatedDoc = await uploadRes.json().catch(() => null);
      if (updatedDoc) setDoc(updatedDoc);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setManualUploading(false);
    }
  };

  // ── Zoom handlers ─────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    const newZoom = Math.min(5.0, parseFloat((zoomLevelRef.current + 0.25).toFixed(2)));
    zoomLevelRef.current = newZoom;
    setZoomLevel(newZoom);
    if (pdfDoc) renderPage(pdfDoc, sigPage, newZoom);
  };
  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, parseFloat((zoomLevelRef.current - 0.25).toFixed(2)));
    zoomLevelRef.current = newZoom;
    setZoomLevel(newZoom);
    if (pdfDoc) renderPage(pdfDoc, sigPage, newZoom);
  };

  // ── Resize handle helper ──────────────────────────────────────────────────
  // FIX #3: X button is now outside; FIX #4: aspectRatio stored on mousedown
  const HANDLE_R = isMobile ? 4 : 7;
  const makeResizeHandle = (corner: "se" | "sw" | "ne" | "nw") => {
    const pos: React.CSSProperties = {
      position: "absolute",
      width: HANDLE_R * 2,
      height: HANDLE_R * 2,
      borderRadius: "50%",
      background: "white",
      border: "2px solid #3b82f6",
      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      zIndex: 20,
      cursor: corner === "se" ? "se-resize" : corner === "sw" ? "sw-resize" : corner === "ne" ? "ne-resize" : "nw-resize",
      touchAction: "none",
    };
    if (corner === "nw") { pos.top = -HANDLE_R; pos.left = -HANDLE_R; }
    else if (corner === "ne") { pos.top = -HANDLE_R; pos.right = -HANDLE_R; }
    else if (corner === "sw") { pos.bottom = -HANDLE_R; pos.left = -HANDLE_R; }
    else { pos.bottom = -HANDLE_R; pos.right = -HANDLE_R; }

    const onDown = (clientX: number, clientY: number) => {
      resizingStamp.current = {
        startX: clientX, startY: clientY,
        origW: sigBoxW, origH: sigBoxH, origX: sigX, origY: sigY,
        corner,
        // FIX #4: capture the ratio at the moment the user starts resizing
        aspectRatio: sigBoxW / sigBoxH,
      };
    };
    return (
      <div
        key={corner}
        style={pos}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDown(e.clientX, e.clientY); }}
        onTouchStart={e => { e.preventDefault(); e.stopPropagation(); const t = e.touches[0]; onDown(t.clientX, t.clientY); }}
      />
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
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
        <button onClick={() => navigate("/dtms/user/documents")}
          className="mt-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
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
        <button onClick={() => navigate("/dtms/user/documents")}
          className="mt-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
          Back to My Documents
        </button>
      </div>
    </UserLayout>
  );

  const fallbackName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const selectedSignatureProfileName = signatureProfiles.find(p => p.id === selectedSignatureId)?.name || "";
  const selectedFileName = (() => {
    const rawPath = activeDocFile?.file_url || selectedFileUrl || "";
    if (!rawPath) return "";
    const lastSegment = rawPath.split("/").pop() || rawPath;
    const cleanName = lastSegment.split("?")[0];
    try {
      return decodeURIComponent(cleanName);
    } catch {
      return cleanName;
    }
  })();

  return (
    <UserLayout title="Sign Document" subtitle={isBatchMode ? `Batch Signing ${tracksArray.length} Documents` : doc ? `${doc.tracknumber} — ${doc.title}` : "Loading..."}>
      <div className="space-y-1">
        {isBatchMode && !done && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 mb-2 flex flex-col gap-1 items-start sm:px-3 text-blue-700 dark:text-blue-400 max-w-2xl">
            <div className="flex items-center gap-2 w-full">
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <div className="text-sm flex-1">
                <span className="font-semibold">Batch Sign Mode:</span> Selected {tracksArray.length} documents.
              </div>
              {signing && batchProgress && (
                <div className="flex items-center gap-2 text-[11px] font-mono bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {signingProgress?.currentLabel || `Signing: ${batchProgress}`}
                </div>
              )}
            </div>
            {!signing && (
              <p className="text-xs opacity-90 pl-6">
                You are viewing the <span className="font-semibold">First Document</span> as a template. The design and placement of your stamp will be automatically replicated on all other selected documents.
              </p>
            )}
            {signing && (
              <div className="w-full pl-6 mt-1">
                <div className="h-1 w-full bg-blue-200 dark:bg-blue-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${signingProgress && signingProgress.total > 0
                        ? (signingProgress.completed / signingProgress.total) * 100
                        : 8}%`,
                    }} />
                </div>
                {signingProgress && (
                  <p className="mt-1 text-[11px] text-blue-700/90 dark:text-blue-300/90">
                    {signingProgress.completed}/{Math.max(signingProgress.total, signingProgress.completed)} files processed • {signingProgress.success} success • {signingProgress.failed} failed
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Success ── */}
        {done && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-6 py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Document Signed Successfully!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The signed PDF has been uploaded. You can sign again if you need to add another signature placement.
              </p>
              {signingFailures.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 max-w-xl">
                  Completed with warnings: {signingFailures.length} file(s) failed and were skipped. Other files continued processing.
                </p>
              )}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
                <Download className="w-4 h-4" /> Download Signed PDF
              </button>
              {canSign && (
                <button onClick={() => {
                  setDone(false); setPdfVisible(true); setPlacingMode(true); setHoverPx(null);
                  const urlToLoad = activeDocFile?.file_url || doc?.file_url;
                  if (urlToLoad) void loadPdf(urlToLoad, { force: true, fileId: activeDocFile?.id ?? null, page: sigPage });
                }}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition">
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

            {/* ══ PDF VIEWER ══ */}
            <div className="min-w-0 sticky top-4 lg:static">
              {doc && selectedFileUrl ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">

                  {/* File tabs */}
                  {doc.files && doc.files.length > 1 && (
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 flex-wrap border-b border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mr-1">Files:</span>
                      {doc.files.map((f, idx) => {
                        const cfg = fileStampsState[f.id];
                        const isActive = activeDocFile?.id === f.id;
                        return (
                          <button key={f.id} onClick={() => switchToFile(f)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-accent text-foreground hover:bg-accent/70"}`}>
                            {cfg?.placed ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" /> : <FileText className="w-3 h-3 shrink-0 opacity-60" />}
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
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30 flex-wrap">
                    <Eye className="w-4 h-4 text-primary sm:hidden" />
                    <span className="text-sm font-semibold text-foreground sm:hidden">View Document</span>
                    {pdfLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />}
                    {pdfDoc && (
                      <div className="flex items-center gap-1 ml-3">
                        <button onClick={() => setSigPage(p => Math.max(1, p - 1))} disabled={sigPage <= 1}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Previous page">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground font-mono select-none">{sigPage} / {pdfDoc.numPages}</span>
                        <button onClick={() => setSigPage(p => Math.min(pdfDoc.numPages, p + 1))} disabled={sigPage >= pdfDoc.numPages}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Next page">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        {/* Zoom controls */}
                        <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-border">
                          <button onClick={handleZoomOut} disabled={zoomLevel <= 0.5}
                            className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Zoom out">
                            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <span className="text-xs text-muted-foreground font-mono select-none w-10 text-center">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button onClick={handleZoomIn} disabled={zoomLevel >= 5.0}
                            className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Zoom in">
                            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end w-auto sm:w-full sm:grid sm:grid-cols-8 sm:gap-2 sm:items-stretch">
                      {canSign && signatureProfiles.length > 0 && (
                        <div className="flex items-center gap-1.5 mr-1 w-auto sm:w-full sm:col-span-2 sm:mr-0 sm:min-w-0">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide sm:hidden">Sign</span>
                          <select
                            value={selectedSignatureId}
                            onChange={e => handleSignatureProfileSelect(e.target.value)}
                            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-auto max-w-[180px] sm:w-full sm:max-w-none"
                            title={selectedSignatureProfileName ? `Using: ${selectedSignatureProfileName}` : "Select signature"}
                          >
                            {signatureProfiles.map(profile => (
                              <option key={profile.id} value={profile.id}>{profile.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {canSign && selectedFileUrl && !placingMode && (
                        <button
                          onClick={() => {
                            if (!canPlaceSignature) return;
                            setPdfVisible(true); setPlacingMode(true); setHoverPx(null);
                          }}
                          disabled={!canPlaceSignature}
                          title={!canPlaceSignature ? "Please wait for the selected file to finish loading." : undefined}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 w-auto sm:w-full sm:col-span-3">
                          <MousePointer2 className="w-3.5 h-3.5" /> <span className=" sm:hidden">Place Signature</span>
                        </button>
                      )}
                      {canSign && placingMode && (
                        <button onClick={() => { setPlacingMode(false); setHoverPx(null); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition w-auto sm:w-full sm:col-span-3">
                          Cancel Placement
                        </button>
                      )}
                      {canSign && pdfBlobUrl && (
                        <div className="flex items-center justify-center gap-1.5 bg-card rounded-lg border border-border p-1 shadow-sm mr-2 w-auto sm:w-full sm:col-span-3 sm:mr-0 sm:min-w-0 sm:px-2">
                          <span className=" text-[10px] font-bold text-muted-foreground uppercase px-1 sm:hidden">Batch</span>
                          <button onClick={() => setBatchSignPage(!batchSignPage)} title="Apply to all pages in this file"
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${batchSignPage ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                            <Layers className="w-3.5 h-3.5" /> <span className="sm:hidden">By Page</span>
                          </button>
                          <button onClick={() => setBatchSignFile(!batchSignFile)} title="Apply to all files in this document"
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${batchSignFile ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                            <LayoutGrid className="w-3.5 h-3.5" /> <span className="sm:hidden">By File</span>
                          </button>
                        </div>
                      )}
                   
                    </div>
                  </div>

                  {!!selectedFileName && (
                    <div className="px-5 py-2 bg-background/60 border-b border-border">
                      <p className="text-[11px] text-muted-foreground truncate" title={selectedFileName}>
                        File: <span className="font-mono text-foreground">{selectedFileName}</span>
                      </p>
                    </div>
                  )}

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
                        <div ref={outerContainerRef} className="overflow-x-auto" style={{ background: "#e5e7eb" }}>
                        <div ref={viewerContainerRef} className="relative" style={{ width: "max-content", minWidth: "100%" }}>
                          {signing && <SigningOverlay />}
                          <canvas ref={canvasRef} className="block" />

                          {/* ── Placement overlay ── */}
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
                                <span className="flex items-center gap-1.5">
                                  <MousePointer2 className="w-3.5 h-3.5" />
                                  Click to place your signature stamp
                                </span>
                                <span className="font-mono opacity-75">
                                  {hoverPx ? `x:${Math.round(sigX)} y:${Math.round(sigY)} pg:${sigPage}` : "Move cursor to preview"}
                                </span>
                              </div>

                              {hoverPx && (
                                <div
                                  className="absolute pointer-events-none"
                                  style={{
                                    left: hoverPx.left,
                                    top: hoverPx.top,
                                    width: sigBoxW * renderScale,
                                    height: sigBoxH * renderScale,
                                    border: "1.5px dashed #3b82f6",
                                    borderRadius: 3,
                                    background: "rgba(255,255,255,0.85)",
                                    boxShadow: "0 1px 8px rgba(59,130,246,0.18)",
                                    overflow: "hidden",
                                  }}
                                >
                                  <StampPreview
                                    cssW={sigBoxW * renderScale}
                                    cssH={sigBoxH * renderScale}
                                    signImagePreview={signImagePreview}
                                    displayName={displayName}
                                    sigPos={sigPos}
                                    showSignedBy={showSignedBy}
                                    fallbackName={fallbackName}
                                    imgTop={imgTop}
                                    imgLeft={imgLeft}
                                    imgWidthPct={imgWidthPct}
                                    txtTop={txtTop}
                                    txtLeft={txtLeft}
                                    textSizePct={textSizePct}
                                    fontFamily={fontFamily}
                                    isItalic={isItalic}
                                    isBold={isBold}
                                    nameColor={nameColor}
                                    positionColor={positionColor}
                                    signedByColor={signedByColor}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Confirmed stamp ── */}
                          {!placingMode && stampPlaced && (() => {
                            const cssLeft = sigX * renderScale;
                            const cssTop = (pdfPageHeight - sigY - sigBoxH) * renderScale;
                            const cssW = sigBoxW * renderScale;
                            const cssH = sigBoxH * renderScale;

                            return (
                              // FIX #3: wrapper has overflow:visible so X button can live outside the border
                              <div
                                className="absolute select-none"
                                style={{
                                  left: cssLeft, top: cssTop,
                                  width: cssW, height: cssH,
                                  zIndex: 5,
                                  touchAction: "none",
                                  // overflow must be visible so the X button renders outside
                                  overflow: "visible",
                                }}
                              >
                                {/* The visible dashed border box — separate inner div */}
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    border: "1.5px dashed #3b82f6",
                                    borderRadius: 3,
                                    background: "rgba(255,255,255,0.90)",
                                    boxShadow: "0 2px 12px rgba(59,130,246,0.15)",
                                    cursor: "move",
                                    overflow: "hidden",
                                  }}
                                  onMouseDown={e => {
                                    if ((e.target as HTMLElement).dataset.handle) return;
                                    e.preventDefault();
                                    draggingStamp.current = { startX: e.clientX, startY: e.clientY, origX: sigX, origY: sigY };
                                  }}
                                  onTouchStart={e => {
                                    if ((e.target as HTMLElement).dataset.handle) return;
                                    e.preventDefault();
                                    const t = e.touches[0];
                                    draggingStamp.current = { startX: t.clientX, startY: t.clientY, origX: sigX, origY: sigY };
                                  }}
                                >
                                  <StampPreview
                                    cssW={cssW}
                                    cssH={cssH}
                                    signImagePreview={signImagePreview}
                                    displayName={displayName}
                                    sigPos={sigPos}
                                    showSignedBy={showSignedBy}
                                    fallbackName={fallbackName}
                                    imgTop={imgTop}
                                    imgLeft={imgLeft}
                                    imgWidthPct={imgWidthPct}
                                    txtTop={txtTop}
                                    txtLeft={txtLeft}
                                    textSizePct={textSizePct}
                                    fontFamily={fontFamily}
                                    isItalic={isItalic}
                                    isBold={isBold}
                                    nameColor={nameColor}
                                    positionColor={positionColor}
                                    signedByColor={signedByColor}
                                  />
                                </div>

                                {/* ── Corner resize handles ── */}
                                {(["nw", "ne", "sw", "se"] as const).map(c => makeResizeHandle(c))}

                                {/* ── FIX #3: X button positioned OUTSIDE the stamp box (top-right, above border) ── */}
                                <div
                                  title="Remove stamp"
                                  data-handle="true"
                                  className="absolute flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full cursor-pointer transition-colors z-30 shadow-md"
                                  style={{
                                    // Sit above and to the right of the stamp border
                                    top: isMobile ? -7 : -10,
                                    right: isMobile ? -7 : -10,
                                    width: isMobile ? 14 : 20,
                                    height: isMobile ? 14 : 20,
                                  }}
                                  onClick={e => {
                                    e.preventDefault(); e.stopPropagation();
                                    setStampPlaced(false);
                                    if (activeDocFile) {
                                      setFileStampsState(prev => {
                                        const copy = { ...prev };
                                        if (copy[activeDocFile.id]) copy[activeDocFile.id] = { ...copy[activeDocFile.id], placed: false };
                                        return copy;
                                      });
                                      if (fileStampRef.current[activeDocFile.id]) fileStampRef.current[activeDocFile.id].placed = false;
                                    }
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
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
                        <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">
                          {Math.round(sigBoxW)}×{Math.round(sigBoxH)} · x:{Math.round(sigX)} y:{Math.round(sigY)} pg:{sigPage}
                        </span>
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
            </div>

            {/* ══ DETAILS + CREDENTIALS + ACTIONS ══ */}
            <div className="flex flex-col gap-4 min-w-0">

              {/* Document info */}
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
                      {doc.message && <p className="text-xs text-muted-foreground mt-1 border-t border-border pt-1 italic">{doc.message}</p>}
                    </div>
                    {isOwner && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">Owner</span>}
                  </div>

                  {/* Signatories list */}
                  {doc.signatories.length > 0 && (() => {
                    const sortedByOrder = [...doc.signatories].sort((a, b) => a.order - b.order);
                    const sorted = [...sortedByOrder].sort((a, b) => {
                      const aIsOwner = a.user_id === doc.userID ? 0 : 1;
                      const bIsOwner = b.user_id === doc.userID ? 0 : 1;
                      if (aIsOwner !== bIsOwner) return aIsOwner - bIsOwner;
                      if (a.order !== b.order) return a.order - b.order;
                      return a.id - b.id;
                    });
                    const uniqueOrders = [...new Set(sorted.map(s => s.order))].sort((a, b) => a - b);
                    const orderToStep: Record<number, number> = {};
                    uniqueOrders.forEach((o, i) => { orderToStep[o] = i + 1; });
                    const officeGroups: Array<{ office: string; sigs: typeof sorted }> = [];
                    const seenOffices = new Set<string>();
                    sorted.forEach(s => {
                      const office = s.user_office?.trim() || "—";
                      if (!seenOffices.has(office)) { seenOffices.add(office); officeGroups.push({ office, sigs: [] }); }
                      officeGroups.find(g => g.office === office)!.sigs.push(s);
                    });
                    return (
                      <div className="mt-4 border-t border-border pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Signatories</p>
                        <div className="flex flex-col gap-4">
                          {officeGroups.map(({ office, sigs }) => (
                            <div key={office}>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 px-1">{office}</p>
                              <div className="flex flex-col gap-1.5">
                                {sigs.map(s => (
                                  <div key={s.id} className={`rounded-lg border px-3 py-2.5 text-xs ${s.status === "signed" ? "border-green-500/30 bg-green-500/5" : s.status === "rejected" ? "border-destructive/30 bg-destructive/5" : "border-border bg-accent/30"}`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="w-5 h-5 rounded-full bg-accent text-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{orderToStep[s.order]}</span>
                                      <span className="text-foreground font-medium">{s.user_name}</span>
                                      {s.user_id === doc.userID && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Owner</span>}
                                      {s.user_id === user?.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">You</span>}
                                      {s.role === "viewer" && <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Viewer</span>}
                                      <span className="text-muted-foreground truncate hidden sm:inline">{s.user_email}</span>
                                      <span className={`ml-auto px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${s.status === "signed" ? "bg-green-500/10 text-green-600" : s.status === "rejected" ? "bg-destructive/10 text-destructive" : s.status === "viewed" ? "bg-amber-500/10 text-amber-600" : "bg-yellow-500/10 text-yellow-600"}`}>{s.status}</span>
                                    </div>
                                    {s.signed_at && <p className="mt-1 text-muted-foreground pl-7">{s.status === "rejected" ? "Declined" : "Signed"} on {fmtSignedAt(s.signed_at)}</p>}
                                    {s.remarks && <p className={`mt-1 pl-7 italic text-xs ${s.status === "rejected" ? "text-destructive/80" : "text-muted-foreground"}`}>{s.status === "rejected" ? "Reason" : "Remarks"}: {s.remarks}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Edit routing */}
                  {(isOwner || mySig) && !editingRouting && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <button type="button" onClick={openRoutingEditor}
                        className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition">
                        <UserPlus className="w-3.5 h-3.5" /> Edit Routing
                      </button>
                    </div>
                  )}

                  {editingRouting && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> Edit Routing
                        </p>
                        <button type="button" onClick={() => setEditingRouting(false)} className="text-muted-foreground hover:text-foreground transition p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {routingSignatories.length > 0 && (() => {
                        const sortedUniqueOrders = [...new Set(routingSignatories.map(s => s.order))].sort((a, b) => a - b);
                        const stepNum = (order: number) => sortedUniqueOrders.indexOf(order) + 1;
                        return (
                          <div className="flex flex-col gap-0">
                            {routingSignatories.map((s, i) => {
                              const isLocked = s.status === "signed" || s.status === "rejected";
                              const isParallelWithAbove = i > 0 && s.order === routingSignatories[i - 1].order;
                              return (
                                <div key={s.user_id}>
                                  {i > 0 && (
                                    <div className="flex items-center justify-center h-5">
                                      <button type="button"
                                        title={isParallelWithAbove ? "Click to sign separately" : "Click to sign at the same time as above"}
                                        onClick={() => toggleParallel(i)}
                                        disabled={routingSignatories[i - 1].status === "signed" || routingSignatories[i - 1].status === "rejected"}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isParallelWithAbove ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25" : "bg-accent text-muted-foreground hover:text-foreground"}`}>
                                        {isParallelWithAbove ? <><Link2 className="w-3 h-3" /> parallel &mdash; click to separate</> : <><Link2Off className="w-3 h-3" /> sequential &mdash; click to parallelize</>}
                                      </button>
                                    </div>
                                  )}
                                  <div
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${isLocked ? s.status === "signed" ? "bg-green-500/5 border border-green-500/30" : "bg-destructive/5 border border-destructive/30" : isParallelWithAbove ? "bg-blue-500/5 border border-blue-500/20" : "bg-accent/50 border border-border"} ${draggedSigIdx === i ? "opacity-60" : ""}`}
                                    draggable={!isLocked}
                                    onDragStart={() => { if (!isLocked) handleSigDragStart(i); }}
                                    onDragOver={(e) => { if (!isLocked) handleSigDragOver(i, e); }}
                                    onDragEnd={handleSigDragEnd}
                                    onDrop={handleSigDragEnd}
                                    style={{ cursor: isLocked ? "default" : "move" }}
                                  >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isLocked ? s.status === "signed" ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-destructive/20 text-destructive" : isParallelWithAbove ? "bg-blue-500 text-white" : "bg-primary text-primary-foreground"}`}>{stepNum(s.order)}</span>
                                    <span className="text-foreground font-medium truncate flex-1">{s.user_name}</span>
                                    {s.role === "viewer" && <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">Viewer</span>}
                                    {isLocked && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${s.status === "signed" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>{s.status}</span>}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!isLocked && (
                                        <>
                                          <button type="button" title="Move earlier" onClick={() => moveRoutingSignatory(i, "up")}
                                            disabled={i === 0 || (i > 0 && (routingSignatories[i - 1].status === "signed" || routingSignatories[i - 1].status === "rejected"))}
                                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed">
                                            <ChevronUp className="w-4 h-4" />
                                          </button>
                                          <button type="button" title="Move later" onClick={() => moveRoutingSignatory(i, "down")}
                                            disabled={i === routingSignatories.length - 1 || (i < routingSignatories.length - 1 && (routingSignatories[i + 1].status === "signed" || routingSignatories[i + 1].status === "rejected"))}
                                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed">
                                            <ChevronDown className="w-4 h-4" />
                                          </button>
                                          <button type="button" onClick={() => setRoutingSignatories(prev => normalizeRoutingOrders(prev.filter(x => x.user_id !== s.user_id)))}
                                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition" title="Remove">
                                            <X className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Add signatory picker */}
                      <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-background/50">
                        <p className="text-[11px] text-muted-foreground font-medium">Search employees by name or position</p>
                        <input type="text" placeholder="Search by name, position, or office..." value={routingSearch}
                          onChange={e => { setRoutingSearch(e.target.value); setRoutingPage(0); }}
                          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition" />
                        <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          {filteredRoutingUsers.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">{routingSearch ? "No users match" : "No available users"}</p>
                          ) : (
                            <>
                              {pagedRoutingUsers.map(u => (
                                <div key={u.id} className="flex items-center gap-2 w-full px-3 py-2 border-b border-border last:border-0 text-xs">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{u.first_name.slice(0, 1)}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{u.position || u.email}</p>
                                    {u.office_name && <p className="text-[10px] text-muted-foreground/80 truncate">{u.office_name}</p>}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button type="button" title="Add as Signer"
                                      onClick={() => {
                                        const maxOrder = routingSignatories.length === 0 ? 0 : Math.max(...routingSignatories.map(s => s.order)) + 1;
                                        setRoutingSignatories(prev => [...prev, { user_id: u.id, user_email: u.email, user_name: `${u.first_name} ${u.last_name}`, order: maxOrder, role: "signer" }]);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition text-[10px] font-semibold">
                                      <Plus className="w-3 h-3" /> Signer
                                    </button>
                                    <button type="button" title="Add as Viewer"
                                      onClick={() => {
                                        const maxOrder = routingSignatories.length === 0 ? 0 : Math.max(...routingSignatories.map(s => s.order)) + 1;
                                        setRoutingSignatories(prev => [...prev, { user_id: u.id, user_email: u.email, user_name: `${u.first_name} ${u.last_name}`, order: maxOrder, role: "viewer" }]);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition text-[10px] font-semibold">
                                      <Eye className="w-3 h-3" /> Viewer
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {totalRoutingPages > 1 && (
                                <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-accent/30 text-[10px]">
                                  <span className="text-muted-foreground">{routingPage * ROUTING_PAGE_SIZE + 1}–{Math.min((routingPage + 1) * ROUTING_PAGE_SIZE, filteredRoutingUsers.length)} of {filteredRoutingUsers.length}</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => setRoutingPage(p => p - 1)} disabled={routingPage === 0} className="px-2 py-0.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-40 transition">‹</button>
                                    <button type="button" onClick={() => setRoutingPage(p => p + 1)} disabled={routingPage >= totalRoutingPages - 1} className="px-2 py-0.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-40 transition">›</button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveRouting} disabled={routingSaving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-50">
                          {routingSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save Routing</>}
                        </button>
                        <button type="button" onClick={() => setEditingRouting(false)}
                          className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document files */}
              {doc && (
                <div className="bg-card border border-border rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Files</span>
                    {doc.files && doc.files.length > 0 && (
                      <button onClick={handleDownloadFiles}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Download className="w-3.5 h-3.5" />
                        {doc.files.length > 1 ? `Download all (${doc.files.length})` : "Download"}
                      </button>
                    )}
                  </div>
                  <DocumentFileList
                    document={doc}
                    onFileSelect={(fileUrl) => {
                      const matched = doc.files?.find(f => f.file_url === fileUrl);
                      if (matched) switchToFile(matched);
                        else {
                          activeFileIdRef.current = null;
                          setActiveDocFile(null);
                          setSelectedFileUrl(fileUrl);
                          setPdfVisible(true);
                          setStampPlaced(false);
                          loadPdf(fileUrl, { force: true, fileId: null, page: 1 });
                        }
                    }}
                    selectedFileUrl={selectedFileUrl}
                  />
                </div>
              )}

              {/* Already signed */}
              {mySig && mySig.status === "signed" && !isOwner && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <p className="text-sm text-foreground">
                    You signed this document{mySig.signed_at ? ` on ${fmtSignedAt(mySig.signed_at)}` : ""}.
                  </p>
                </div>
              )}

              {/* Viewer panel */}
              {isViewer && mySig && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">View Only</p>
                      <p className="text-xs text-muted-foreground">
                        You are assigned as a viewer. The document has been automatically marked as viewed and forwarded to the next signatory.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Viewed{mySig.signed_at ? ` on ${fmtSignedAt(mySig.signed_at)}` : ""}
                  </div>
                  {/* Comment box */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-amber-500/20">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Leave a comment (optional)</p>
                    {mySig.remarks && !viewerCommentSaved ? (
                      <p className="text-xs text-muted-foreground italic">Your comment: &ldquo;{mySig.remarks}&rdquo;</p>
                    ) : null}
                    <textarea
                      rows={3}
                      value={viewerComment}
                      onChange={e => { setViewerComment(e.target.value); setViewerCommentSaved(false); }}
                      placeholder={mySig.remarks ? mySig.remarks : "Optional remarks or feedback..."}
                      className="w-full rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none transition"
                    />
                    <button
                      onClick={async () => {
                        if (!mySig) return;
                        setViewerCommentSaving(true);
                        try {
                          await signatoryApi.update(mySig.id, { status: "viewed", remarks: viewerComment });
                          setViewerCommentSaved(true);
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setViewerCommentSaving(false);
                        }
                      }}
                      disabled={viewerCommentSaving || viewerComment.trim() === ""}
                      className="self-end flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {viewerCommentSaving
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                        : viewerCommentSaved
                          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
                          : "Save Comment"}
                    </button>
                  </div>
                </div>
              )}

              {/* Signing panel */}
              {canSign && (
                <div className="flex flex-col gap-4">
                  {/* Mode toggle */}
                  <div className="flex rounded-xl border border-border bg-accent/40 p-1 gap-1">
                    <button onClick={() => setSignMode("digital")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${signMode === "digital" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      <Key className="w-3.5 h-3.5" /> Digital (PNPKI)
                    </button>
                    <button onClick={() => setSignMode("manual")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${signMode === "manual" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      <PenLine className="w-3.5 h-3.5" /> Manual / Handwritten
                    </button>
                  </div>

                  {/* Manual sign */}
                  {signMode === "manual" && (
                    <div className="flex flex-col gap-4">
                      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                          <p className="text-sm font-medium text-foreground">Print the document{doc && doc.files && doc.files.length > 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-8">Download {doc && doc.files && doc.files.length > 1 ? `all ${doc.files.length} files` : "the PDF"}, print, sign by hand, then scan each one.</p>
                        <button onClick={handleDownloadFiles}
                          className="ml-8 flex items-center gap-2 w-fit px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-accent transition">
                          <Printer className="w-4 h-4" /> Download for Printing
                          {doc && doc.files && doc.files.length > 1 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{doc.files.length} files</span>}
                        </button>
                      </div>

                      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                          <p className="text-sm font-medium text-foreground">Upload the signed scan{doc && doc.files && doc.files.length > 1 ? "s" : ""}</p>
                        </div>
                        {(doc?.files && doc.files.length > 0 ? doc.files : []).map((docFile, idx) => {
                          const uploaded = manualSignedFiles[docFile.id];
                          return (
                            <div key={docFile.id} className="ml-8 flex flex-col gap-1">
                              {doc!.files!.length > 1 && <span className="text-xs font-medium text-muted-foreground">File {idx + 1}</span>}
                              <label
                                onDragOver={e => { e.preventDefault(); setManualDragging(true); }}
                                onDragEnter={e => { e.preventDefault(); setManualDragging(true); }}
                                onDragLeave={() => setManualDragging(false)}
                                onDrop={e => {
                                  e.preventDefault(); setManualDragging(false);
                                  const f = e.dataTransfer.files[0];
                                  if (f && f.type === "application/pdf") {
                                    const fileErr = getManualUploadSizeError(f);
                                    if (fileErr) {
                                      setError(fileErr);
                                      return;
                                    }
                                    setError(null);
                                    setManualSignedFiles(prev => ({ ...prev, [docFile.id]: f }));
                                  }
                                }}
                                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition ${manualDragging ? "border-primary bg-primary/5" : uploaded ? "border-green-500/50 bg-green-500/5" : "border-border bg-background hover:border-primary/40"}`}>
                                {uploaded ? (
                                  <><CheckCircle2 className="w-5 h-5 text-green-500" /><p className="text-sm font-medium text-foreground text-center truncate max-w-[220px]">{uploaded.name}</p><p className="text-xs text-muted-foreground">{(uploaded.size / 1024).toFixed(0)} KB — click to replace</p></>
                                ) : (
                                  <><Upload className="w-5 h-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">Drop PDF here or <span className="text-primary font-medium">click to browse</span></p><p className="text-xs text-muted-foreground">Scanned / photographed copy (PDF only)</p></>
                                )}
                                <input type="file" accept="application/pdf" className="hidden"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    const fileErr = getManualUploadSizeError(f);
                                    if (fileErr) {
                                      setError(fileErr);
                                      e.target.value = "";
                                      return;
                                    }
                                    setError(null);
                                    setManualSignedFiles(prev => ({ ...prev, [docFile.id]: f }));
                                  }} />
                              </label>
                            </div>
                          );
                        })}
                      </div>

                      {mySig && mySig.status === "pending" && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">Remarks <span className="text-muted-foreground font-normal">(optional)</span></label>
                          <textarea rows={2} value={signRemarks} onChange={e => setSignRemarks(e.target.value)}
                            placeholder="Add a note about your signature..."
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition" />
                        </div>
                      )}

                      {error && (
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                          <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {mySig && mySig.status === "pending" && (
                          <button onClick={() => setDeclineOpen(true)} disabled={manualUploading}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-destructive/60 text-destructive text-sm font-semibold hover:bg-destructive/10 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        )}
                        <button onClick={handleManualSign} disabled={manualUploading || Object.keys(manualSignedFiles).length === 0}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {manualUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><PenLine className="w-4 h-4" /> Submit Signed {Object.keys(manualSignedFiles).length > 1 ? `(${Object.keys(manualSignedFiles).length} files)` : "Copy"}</>}
                        </button>
                      </div>
                      {Object.keys(manualSignedFiles).length === 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">⚠ Upload your scanned signed {doc && doc.files && doc.files.length > 1 ? "copies" : "copy"} (PDF) before submitting.</p>
                      )}
                    </div>
                  )}

              
                  {signMode === "digital" && (
                    <>
                      <div className="bg-card border border-border rounded-xl overflow-hidden">
                    
                      </div>

                      {signing && signingProgress && (
                        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="font-medium">{signingProgress.currentLabel || "Signing in progress..."}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-blue-200/70 dark:bg-blue-900/40 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{
                                width: `${signingProgress.total > 0
                                  ? (signingProgress.completed / signingProgress.total) * 100
                                  : 8}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-blue-700/90 dark:text-blue-300/90">
                            {signingProgress.completed}/{Math.max(signingProgress.total, signingProgress.completed)} processed • {signingProgress.success} success • {signingProgress.failed} failed
                          </p>
                        </div>
                      )}

                      {!signing && signingFailures.length > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                          <p className="font-semibold mb-1">Some files were skipped due to errors:</p>
                          <div className="space-y-1 max-h-28 overflow-auto pr-1">
                            {signingFailures.slice(0, 8).map((failure, idx) => (
                              <p key={`${failure}-${idx}`} className="break-words">• {failure}</p>
                            ))}
                            {signingFailures.length > 8 && (
                              <p>• ...and {signingFailures.length - 8} more</p>
                            )}
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                          <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                        </div>
                      )}

                      {mySig && mySig.status === "pending" && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-foreground">Remarks <span className="text-muted-foreground font-normal">(optional)</span></label>
                          <textarea rows={2} value={signRemarks} onChange={e => setSignRemarks(e.target.value)}
                            placeholder="Add a note about your signature..."
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition" />
                        </div>
                      )}

                      <div className="flex gap-2">
                        {mySig && mySig.status === "pending" && (
                          <button onClick={() => setDeclineOpen(true)} disabled={signing}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-destructive/60 text-destructive text-sm font-semibold hover:bg-destructive/10 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        )}
                        <button onClick={handleSign}
                          disabled={signing || Object.values(fileStampsState).every(c => !c.placed)}
                          title={Object.values(fileStampsState).every(c => !c.placed) ? "Place your signature on at least one file first" : undefined}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {signing ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing document...</> : <><Key className="w-4 h-4" /> Sign with PNPKI</>}
                        </button>
                      </div>
                      {Object.values(fileStampsState).every(c => !c.placed) && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                          ⚠ Click <strong>Place Signature</strong> on the document viewer to position your stamp before signing.
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground text-center">
                        Your P12 certificate and password are used only in your browser and are never sent to our server. If you wish to change your Digital Signature, you may go to the Settings.
                      </p>
                    </>
                  )}
                </div>
              )}

              {!canSign && !isViewer && !error && doc && !loading && (
                <div className="bg-accent/40 border border-border rounded-xl px-5 py-4 text-sm text-muted-foreground">
                  You are not assigned as a signatory for this document.
                </div>
              )}
              {error && !canSign && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decline modal */}
      {declineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Decline to Sign</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Please provide a reason so the sender understands why the document was declined.</p>
              </div>
            </div>
            <div className="bg-accent/50 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-foreground truncate">{doc?.title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc?.tracknumber}</p>
            </div>
            <textarea rows={4} placeholder="Reason for declining (optional but recommended)..."
              value={declineReason} onChange={e => setDeclineReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40 resize-none transition" />
            <div className="flex gap-3">
              <button onClick={() => { setDeclineOpen(false); setDeclineReason(""); }} disabled={declining}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDecline} disabled={declining}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
                {declining ? <><Loader2 className="w-4 h-4 animate-spin" /> Declining...</> : <><XCircle className="w-4 h-4" /> Confirm Decline</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default SignDocument;