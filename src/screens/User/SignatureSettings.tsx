import { useState, useRef, useEffect, useCallback } from "react";
import { Key, Upload, Save, CheckCircle2, FileKey2, Type, Image as ImageIcon, Trash2, MousePointer2, FileText, X, Loader2, Eye, Lock, Unlock, ZoomIn, ZoomOut, ChevronDown } from "lucide-react";
import UserLayout from "./UserLayout";
import { useAuth } from "../Auth/AuthContext";
import * as pdfjsLib from "pdfjs-dist";
import { buildStampDataUrl } from "./stampUtils";
import {
  SignatureProfile,
  createSignatureProfileId,
  ensureSignatureProfiles,
  setActiveSignatureProfileId,
  syncLegacyStorageFromProfile,
  writeSignatureProfiles,
} from "./signatureProfiles";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;

/**
 * Signature Settings — all data is stored in localStorage ONLY.
 * Nothing is sent to the server.
 *
 * Stamp rendering is delegated to stampUtils.ts, which is also used by
 * SignDocument to build the sign_design PNG sent to the Flask /sign-pdf
 * endpoint.
 */

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const STAMP_BOX_W    = 140;
const STAMP_BOX_H    = 50;
const DESIGNER_BASE_W = 330;

const FONT_OPTIONS = [
  { value: "Inter, sans-serif",           label: "Inter" },
  { value: "Arial, sans-serif",          label: "Arial" },
  { value: "'Times New Roman', serif",   label: "Times New Roman" },
  { value: "Georgia, serif",             label: "Georgia" },
  { value: "Verdana, sans-serif",        label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "'Courier New', monospace",   label: "Courier New" },
  { value: "'Brush Script MT', cursive", label: "Brush Script MT" },
  { value: "'Segoe Script', cursive",    label: "Segoe Script" },
  { value: "'Segoe Script Bold', cursive", label: "Segoe Script Bold" },
  { value: "'Comic Sans MS', cursive",   label: "Comic Sans MS" },
];

const SignatureSettings = () => {
  const { user } = useAuth();

  const [password, setPassword]         = useState(localStorage.getItem("sig_password")    || "");
  const [displayName, setDisplayName]   = useState(localStorage.getItem("sig_displayName") || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim());
  const [position, setPosition]         = useState(localStorage.getItem("sig_position")    || user?.position || "");

  // textSizePct: text height as fraction of stamp height (stored as 0–100 for slider UX)
  const [textSizePct, setTextSizePct]   = useState(Number(localStorage.getItem("sig_text_size_pct")) || 18);
  // imgWidthPct: image width as % of stamp width
  const [imgWidthPct, setImgWidthPct]   = useState(Number(localStorage.getItem("sig_image_width_pct")) || 35);
  const [stampWidth, setStampWidth]     = useState(Number(localStorage.getItem("sig_stamp_width")) || STAMP_BOX_W);
  const [stampHeight, setStampHeight]   = useState(Number(localStorage.getItem("sig_stamp_height")) || STAMP_BOX_H);
  const [lockRatio, setLockRatio]       = useState(localStorage.getItem("sig_lock_ratio") === "true");

  // "Digitally Signed by: " label toggle
  const [showSignedBy, setShowSignedBy] = useState(localStorage.getItem("sig_show_signed_by") === "true");

  // Font style + colors
  const [fontFamily, setFontFamily]           = useState(localStorage.getItem("sig_font_family")       || "Inter, sans-serif");
  const [isItalic, setIsItalic]               = useState(localStorage.getItem("sig_is_italic") === "true");
  const [isBold, setIsBold]                   = useState(localStorage.getItem("sig_is_bold") !== "false");
  const [nameColor, setNameColor]             = useState(localStorage.getItem("sig_name_color")         || "#1e3a5f");
  const [positionColor, setPositionColor]     = useState(localStorage.getItem("sig_pos_color")          || "#2563eb");
  const [signedByColor, setSignedByColor]     = useState(localStorage.getItem("sig_signed_by_color")   || "#64748b");

  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  const [signImagePreview, setSignImagePreview] = useState<string | null>(localStorage.getItem("sig_image_data") || null);
  const [signImageFile, setSignImageFile]       = useState<File | null>(null);

  const [p12FileName, setP12FileName] = useState<string>(localStorage.getItem("sig_p12_name") || "");
  const [p12Data, setP12Data]         = useState<string | null>(localStorage.getItem("sig_p12_data"));
  const [p12Loaded, setP12Loaded]     = useState(!!localStorage.getItem("sig_p12_data"));

  const [profiles, setProfiles] = useState<SignatureProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profileName, setProfileName] = useState("Default Signature");
  const [profileActionMessage, setProfileActionMessage] = useState("");
  const [profileActionType, setProfileActionType] = useState<"success" | "warning">("success");

  const [saved, setSaved] = useState(false);

  // Stamp layout — % position of element center (top-left origin) synced with SignDocument
  const [imgTop,   setImgTop]   = useState(Number(localStorage.getItem("sig_img_top"))   || 5);
  const [imgLeft,  setImgLeft]  = useState(Number(localStorage.getItem("sig_img_left"))  || 50);
  const [txtTop,   setTxtTop]   = useState(Number(localStorage.getItem("sig_txt_top"))   || 55);
  const [txtLeft,  setTxtLeft]  = useState(Number(localStorage.getItem("sig_txt_left"))  || 50);
  const [dragging, setDragging] = useState<null | "img" | "txt">(null);
  const stampDesRef = useRef<HTMLDivElement>(null);

  // locked ratio (width/height) — captured only when the user clicks Lock,
  // never auto-updated so it stays stable while sliders move.
  const lockedRatio = useRef(stampWidth / Math.max(1, stampHeight));

  const handleStampWidthChange = (val: number) => {
    setStampWidth(val);
    if (lockRatio) setStampHeight(Math.round(val / lockedRatio.current));
  };
  const handleStampHeightChange = (val: number) => {
    setStampHeight(val);
    if (lockRatio) setStampWidth(Math.round(val * lockedRatio.current));
  };
  const handleLockRatio = () => {
    if (!lockRatio) {
      // Capture current ratio at the moment of locking
      lockedRatio.current = stampWidth / Math.max(1, stampHeight);
    }
    setLockRatio(v => !v);
  };

  const applyProfileToState = useCallback((profile: SignatureProfile) => {
    setPassword(profile.password || "");
    setDisplayName(profile.displayName || "");
    setPosition(profile.position || "");
    setTextSizePct(profile.textSizePct || 18);
    setImgWidthPct(profile.imgWidthPct || 35);
    setStampWidth(profile.stampWidth || STAMP_BOX_W);
    setStampHeight(profile.stampHeight || STAMP_BOX_H);
    setLockRatio(!!profile.lockRatio);
    setImgTop(profile.imgTop || 5);
    setImgLeft(profile.imgLeft || 50);
    setTxtTop(profile.txtTop || 55);
    setTxtLeft(profile.txtLeft || 50);
    setShowSignedBy(!!profile.showSignedBy);
    setFontFamily(profile.fontFamily || "Inter, sans-serif");
    setIsItalic(!!profile.isItalic);
    setIsBold(profile.isBold !== false);
    setNameColor(profile.nameColor || "#1e3a5f");
    setPositionColor(profile.positionColor || "#2563eb");
    setSignedByColor(profile.signedByColor || "#64748b");
    setSignImagePreview(profile.signImageData || null);
    setSignImageFile(null);
    setP12FileName(profile.p12Name || "");
    setP12Data(profile.p12Data || null);
    setP12Loaded(!!profile.p12Data);
    lockedRatio.current = (profile.stampWidth || STAMP_BOX_W) / Math.max(1, profile.stampHeight || STAMP_BOX_H);
  }, []);

  useEffect(() => {
    const { profiles: loadedProfiles, activeId } = ensureSignatureProfiles();
    setProfiles(loadedProfiles);
    setActiveProfileId(activeId);
    const active = loadedProfiles.find(p => p.id === activeId) || loadedProfiles[0];
    if (!active) return;
    setProfileName(active.name || "Default Signature");
    applyProfileToState(active);
    syncLegacyStorageFromProfile(active);
  }, [applyProfileToState]);

  const buildProfileFromState = useCallback((id: string, name: string): SignatureProfile => ({
    id,
    name: name.trim() || "Untitled Signature",
    password,
    displayName,
    position,
    textSizePct,
    imgWidthPct,
    stampWidth,
    stampHeight,
    lockRatio,
    imgTop,
    imgLeft,
    txtTop,
    txtLeft,
    showSignedBy,
    fontFamily,
    isItalic,
    isBold,
    nameColor,
    positionColor,
    signedByColor,
    signImageData: signImagePreview,
    p12Name: p12FileName,
    p12Data,
    updatedAt: Date.now(),
  }), [
    password, displayName, position,
    textSizePct, imgWidthPct, stampWidth, stampHeight, lockRatio,
    imgTop, imgLeft, txtTop, txtLeft,
    showSignedBy, fontFamily, isItalic, isBold,
    nameColor, positionColor, signedByColor,
    signImagePreview, p12FileName, p12Data,
  ]);

  const handleProfileSelect = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    setActiveProfileId(id);
    setProfileName(profile.name || "Default Signature");
    setActiveSignatureProfileId(id);
    applyProfileToState(profile);
    syncLegacyStorageFromProfile(profile);
    setSaved(false);
  };

  const handleCreateProfile = () => {
    const newProfile: SignatureProfile = buildProfileFromState(createSignatureProfileId(), `Signature ${profiles.length + 1}`);
    const next = [...profiles, newProfile];
    setProfiles(next);
    setActiveProfileId(newProfile.id);
    setProfileName(newProfile.name);
    writeSignatureProfiles(next);
    setActiveSignatureProfileId(newProfile.id);
    syncLegacyStorageFromProfile(newProfile);
    setProfileActionType("success");
    setProfileActionMessage(`Created profile \"${newProfile.name}\".`);
    setTimeout(() => setProfileActionMessage(""), 2200);
    setSaved(false);
  };

  const handleDuplicateProfile = () => {
    const source = buildProfileFromState(activeProfileId || createSignatureProfileId(), profileName || "Signature");
    const cloned = { ...source, id: createSignatureProfileId(), name: `${source.name} Copy`, updatedAt: Date.now() };
    const next = [...profiles, cloned];
    setProfiles(next);
    setActiveProfileId(cloned.id);
    setProfileName(cloned.name);
    writeSignatureProfiles(next);
    setActiveSignatureProfileId(cloned.id);
    syncLegacyStorageFromProfile(cloned);
    setProfileActionType("success");
    setProfileActionMessage(`Added copy \"${cloned.name}\".`);
    setTimeout(() => setProfileActionMessage(""), 2200);
    setSaved(false);
  };

  const handleDeleteProfile = () => {
    if (profiles.length <= 1) return;
    const deleting = profiles.find(p => p.id === activeProfileId);
    const ok = window.confirm(`Delete profile \"${deleting?.name || "this profile"}\"?`);
    if (!ok) return;
    const remaining = profiles.filter(p => p.id !== activeProfileId);
    if (!remaining.length) return;
    const nextActive = remaining[0];
    setProfiles(remaining);
    setActiveProfileId(nextActive.id);
    setProfileName(nextActive.name);
    writeSignatureProfiles(remaining);
    setActiveSignatureProfileId(nextActive.id);
    applyProfileToState(nextActive);
    syncLegacyStorageFromProfile(nextActive);
    setProfileActionType("warning");
    setProfileActionMessage(`Deleted profile. Switched to \"${nextActive.name}\".`);
    setTimeout(() => setProfileActionMessage(""), 2600);
    setSaved(false);
  };

  // ── Test Sign state ─────────────────────────────────────────────────────
  const [testPdfFile,    setTestPdfFile]    = useState<File | null>(null);
  const [testPdfDoc,     setTestPdfDoc]     = useState<any>(null);
  const [testPdfLoading, setTestPdfLoading] = useState(false);
  const [testPdfError,   setTestPdfError]   = useState<string | null>(null);
  const [testRenderScale,   setTestRenderScale]   = useState(1);
  const [testPageWidth,     setTestPageWidth]     = useState(595);
  const [testPageHeight,    setTestPageHeight]    = useState(842);
  const [testSigX,   setTestSigX]   = useState(170);
  const [testSigY,   setTestSigY]   = useState(720);
  const [testBoxW,   setTestBoxW]   = useState(stampWidth);
  const [testBoxH,   setTestBoxH]   = useState(stampHeight);
  const [testPage,   setTestPage]   = useState(1);

  // Drawing state (Adobe-style drag-to-draw)
  const [drawState, setDrawState]   = useState<"idle" | "drawing" | "placed">("idle");
  const drawOrigin = useRef<{x:number;y:number;pdfX:number;pdfY:number}|null>(null);
  const [drawRect, setDrawRect]     = useState<{left:number;top:number;width:number;height:number}|null>(null);

  const [testBaked,     setTestBaked]     = useState<string|null>(null);
  const [testBaking,    setTestBaking]    = useState(false);
  const testCanvasRef       = useRef<HTMLCanvasElement>(null);
  const outerTestContainerRef = useRef<HTMLDivElement>(null); // measures available width (zoom-independent)
  const testContainerRef    = useRef<HTMLDivElement>(null);   // matches canvas size for overlay positioning
  const testRenderTaskRef   = useRef<any>(null);

  // Zoom state for the test preview
  const testZoomLevelRef = useRef(1.0);
  const [testZoomLevel, setTestZoomLevel] = useState(1.0);

  // Drag-move placed stamp
  const movingStamp = useRef<{startX:number;startY:number;origX:number;origY:number}|null>(null);
  const resizingStamp = useRef<{startX:number;startY:number;origW:number;origH:number;origY:number}|null>(null);

  // Designer scale: always fill DESIGNER_BASE_W
  const designerScale      = DESIGNER_BASE_W / Math.max(1, stampWidth);
  const designerW          = DESIGNER_BASE_W;
  const designerH          = Math.max(40, Math.round(stampHeight * designerScale));

  // In designer, all sizes are derived from box dims — no independent sliders for font/img size in px
  const designerImgW       = (imgWidthPct / 100) * designerW;
  const designerNameSize   = (textSizePct / 100) * designerH || 0.01;
  const designerPosSize    = (textSizePct / 100) * 0.833 * designerH || 0.01;
  const designerSignedBySize = (textSizePct / 100) * 0.667 * designerH || 0.01;

  useEffect(() => {
    setTestBoxW(stampWidth);
    setTestBoxH(stampHeight);
    setTestBaked(null);
  }, [stampWidth, stampHeight]);

  const testRenderPage = useCallback(async (doc: any, pageNum: number, zoom?: number) => {
    if (!testCanvasRef.current || !outerTestContainerRef.current) return;
    if (testRenderTaskRef.current) {
      testRenderTaskRef.current.cancel();
      try { await testRenderTaskRef.current.promise; } catch (_) {}
      testRenderTaskRef.current = null;
    }
    const page = await doc.getPage(pageNum);
    const vp1  = page.getViewport({ scale: 1 });
    // Always measure the outer container so zoom doesn't feedback-loop the width
    const cw   = outerTestContainerRef.current.clientWidth || 600;
    const scale = (cw / vp1.width) * (zoom ?? testZoomLevelRef.current);
    const vp   = page.getViewport({ scale });
    const canvas = testCanvasRef.current;
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const task = page.render({ canvasContext: ctx, viewport: vp });
    testRenderTaskRef.current = task;
    try { await task.promise; } catch (err: any) {
      if (err?.name === "RenderingCancelledException") return;
      throw err;
    }
    testRenderTaskRef.current = null;
    setTestRenderScale(scale);
    setTestPageWidth(vp1.width);
    setTestPageHeight(vp1.height);
  }, []);

  useEffect(() => {
    if (testPdfDoc) testRenderPage(testPdfDoc, testPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testPage, testPdfDoc]);

  // ── Global mouse handlers for move/resize of placed stamp ──
  useEffect(() => {
    const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v));
    const onMove = (e: MouseEvent) => {
      if (movingStamp.current) {
        const { startX, startY, origX, origY } = movingStamp.current;
        const dx = (e.clientX - startX) / testRenderScale;
        const dy = (e.clientY - startY) / testRenderScale;
        setTestSigX(clamp(origX + dx, 0, testPageWidth  - testBoxW));
        setTestSigY(clamp(origY - dy, 0, testPageHeight - testBoxH));
      }
      if (resizingStamp.current) {
        const { startX, startY, origW, origH, origY } = resizingStamp.current;
        const dw = (e.clientX - startX) / testRenderScale;
        const dh = (e.clientY - startY) / testRenderScale;
        const newW = Math.round(clamp(origW + dw, 30, testPageWidth));
        const newH = lockRatio
          ? Math.round(newW / lockedRatio.current)
          : Math.round(clamp(origH + dh, 15, testPageHeight));
        setTestBoxW(newW);
        setTestBoxH(newH);
        setTestSigY(clamp(origY - (newH - origH), 0, testPageHeight - 15));
      }
    };
    const onUp = () => { movingStamp.current = null; resizingStamp.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [testRenderScale, testPageWidth, testPageHeight, testBoxW, testBoxH, lockRatio]);

  // ── Adobe-style drag-to-draw handlers ──
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawState !== "idle") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pdfX = px / testRenderScale;
    const pdfY = testPageHeight - py / testRenderScale;
    drawOrigin.current = { x: px, y: py, pdfX, pdfY };
    setDrawState("drawing");
    setDrawRect({ left: px, top: py, width: 0, height: 0 });
    setTestBaked(null);
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawState !== "drawing" || !drawOrigin.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const ox = drawOrigin.current.x;
    const oy = drawOrigin.current.y;
    let w = px - ox;
    let h = py - oy;
    if (lockRatio) {
      const r = lockedRatio.current;
      // keep sign, scale smaller axis
      if (Math.abs(w / r) < Math.abs(h)) {
        h = w / r;
      } else {
        w = h * r;
      }
    }
    setDrawRect({
      left:   w >= 0 ? ox : ox + w,
      top:    h >= 0 ? oy : oy + h,
      width:  Math.abs(w),
      height: Math.abs(h),
    });
  };

  const handleOverlayMouseUp = (_e: React.MouseEvent<HTMLDivElement>) => {
    if (drawState !== "drawing" || !drawOrigin.current || !drawRect) return;
    const sc = testRenderScale;
    const minPx = 20; // minimum box size in screen px
    if (drawRect.width < minPx || drawRect.height < minPx) {
      // Too small — cancel
      setDrawState("idle");
      setDrawRect(null);
      drawOrigin.current = null;
      return;
    }
    const newW = Math.round(drawRect.width  / sc);
    const newH = Math.round(drawRect.height / sc);
    const newX = drawRect.left / sc;
    const newY = testPageHeight - (drawRect.top + drawRect.height) / sc;
    setTestBoxW(Math.max(10, newW));
    setTestBoxH(Math.max(5,  newH));
    setTestSigX(Math.max(0, Math.min(testPageWidth  - newW, newX)));
    setTestSigY(Math.max(0, Math.min(testPageHeight - newH, newY)));
    setDrawState("placed");
    setDrawRect(null);
    drawOrigin.current = null;
  };

  const handleTestZoomIn = () => {
    const newZoom = Math.min(3.0, parseFloat((testZoomLevelRef.current + 0.25).toFixed(2)));
    testZoomLevelRef.current = newZoom;
    setTestZoomLevel(newZoom);
    if (testPdfDoc) testRenderPage(testPdfDoc, testPage, newZoom);
  };
  const handleTestZoomOut = () => {
    const newZoom = Math.max(0.5, parseFloat((testZoomLevelRef.current - 0.25).toFixed(2)));
    testZoomLevelRef.current = newZoom;
    setTestZoomLevel(newZoom);
    if (testPdfDoc) testRenderPage(testPdfDoc, testPage, newZoom);
  };

  const handleTestPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTestPdfFile(file);
    setTestPdfDoc(null);
    setDrawState("idle");
    setDrawRect(null);
    setTestBaked(null);
    setTestPdfError(null);
    setTestPdfLoading(true);
    // Reset zoom on new file
    testZoomLevelRef.current = 1.0;
    setTestZoomLevel(1.0);
    try {
      const ab = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: ab });
      const doc = await loadingTask.promise;
      setTestPdfDoc(doc);
      setTestPage(1);
      await testRenderPage(doc, 1);
    } catch (err: any) {
      setTestPdfError(err?.message || "Failed to load PDF.");
    } finally {
      setTestPdfLoading(false);
    }
  };

  /** Bake composite stamp image onto a copy of the PDF canvas using stampUtils */
  const handleBakePreview = async () => {
    if (!testPdfDoc || !testCanvasRef.current) return;
    setTestBaking(true);
    try {
      // 1. Render the stamp at 4× resolution via the shared utility
      const stampDataUrl = await buildStampDataUrl({
        signImagePreview,
        imgTop, imgLeft, imgWidthPct,
        txtTop, txtLeft,
        showSignedBy, displayName, position,
        textSizePct: textSizePct / 100,
        stampWidthPt:  testBoxW,
        stampHeightPt: testBoxH,
        renderScale: 4,
        fontFamily,
        isItalic,
        isBold,
        nameColor,
        positionColor,
        signedByColor,
      });

      // 2. Composite over the rendered PDF canvas
      const stampImg = new Image();
      await new Promise<void>((resolve, reject) => {
        stampImg.onload  = () => resolve();
        stampImg.onerror = reject;
        stampImg.src     = stampDataUrl;
      });

      const pdfCv  = testCanvasRef.current!;
      const outCv  = document.createElement("canvas");
      outCv.width  = pdfCv.width;
      outCv.height = pdfCv.height;
      const oCtx   = outCv.getContext("2d")!;
      oCtx.drawImage(pdfCv, 0, 0);

      const cssLeft = testSigX       * testRenderScale;
      const cssTop  = (testPageHeight - testSigY - testBoxH) * testRenderScale;
      const cssW    = testBoxW * testRenderScale;
      const cssH    = testBoxH * testRenderScale;
      oCtx.drawImage(stampImg, cssLeft, cssTop, cssW, cssH);

      setTestBaked(outCv.toDataURL("image/png"));
    } finally {
      setTestBaking(false);
    }
  };

  // Close font dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setFontDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Mouse and touch drag handler for stamp designer
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !stampDesRef.current) return;
      let clientX: number, clientY: number;
      if (e instanceof TouchEvent) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        if (dragging) e.preventDefault();
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rect = stampDesRef.current.getBoundingClientRect();
      const pctX = Math.max(0, Math.min(100, ((clientX - rect.left)  / rect.width)  * 100));
      const pctY = Math.max(0, Math.min(95,  ((clientY - rect.top)   / rect.height) * 100));
      if (dragging === "img") { setImgLeft(Math.round(pctX)); setImgTop(Math.round(pctY)); }
      else                    { setTxtLeft(Math.round(pctX)); setTxtTop(Math.round(pctY)); }
    };
    const onUp = () => setDragging(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend",  onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onUp);
    };
  }, [dragging]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setSignImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleP12Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setP12FileName(file.name);
    setP12Loaded(false);
    try {
      const b64 = await fileToBase64(file);
      setP12Data(b64);
      setP12Loaded(true);
    } catch {
      alert("Failed to read P12 file.");
    }
  };

  const getDisplayNameLines = (name: string) => {
    if (!name) return [""];
    return name.split(/<br\s*\/?>(?![^<]*>)/i);
  };

  const handleSave = () => {
    const id = activeProfileId || createSignatureProfileId();
    const updated = buildProfileFromState(id, profileName);
    const exists = profiles.some(p => p.id === id);
    const next = exists ? profiles.map(p => (p.id === id ? updated : p)) : [...profiles, updated];
    setProfiles(next);
    setActiveProfileId(updated.id);
    writeSignatureProfiles(next);
    setActiveSignatureProfileId(updated.id);
    syncLegacyStorageFromProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    setPassword(""); setDisplayName(""); setPosition("");
    setSignImagePreview(null); setSignImageFile(null);
    setP12FileName(""); setP12Data(null); setP12Loaded(false);
    setTextSizePct(18); setImgWidthPct(35);
    setStampWidth(STAMP_BOX_W); setStampHeight(STAMP_BOX_H);
    setLockRatio(false);
    setImgTop(5); setImgLeft(50); setTxtTop(55); setTxtLeft(50);
    setShowSignedBy(false);
    setFontFamily("Inter, sans-serif");
    setIsItalic(false);
    setIsBold(true);
    setNameColor("#1e3a5f");
    setPositionColor("#2563eb");
    setSignedByColor("#64748b");
  };

  // ── Stamp preview overlay rendered on canvas for "placed" state ──
  const placedStampCss = drawState === "placed" ? (() => {
    const cssLeft = testSigX * testRenderScale;
    const cssTop  = (testPageHeight - testSigY - testBoxH) * testRenderScale;
    const cssW    = testBoxW * testRenderScale;
    const cssH    = testBoxH * testRenderScale;
    return { cssLeft, cssTop, cssW, cssH };
  })() : null;

  return (
    <UserLayout title="Signature Settings" subtitle="Configure your personal digital signing credentials">

      <div className="flex flex-col gap-5">

        {/* Privacy notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <Key className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Privacy Notice:</span> Your P12 certificate, password, and signing data are stored only in your browser's localStorage. They are never sent to or stored on the server.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Signature Profiles</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Choose profile</label>
              <select
                value={activeProfileId}
                onChange={e => handleProfileSelect(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Profile name</label>
              <input
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="e.g. Approver Signature"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCreateProfile}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition"
            >
              New Profile
            </button>
            <button
              onClick={handleDuplicateProfile}
              disabled={!profiles.length}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition disabled:opacity-50"
            >
              Duplicate Current
            </button>
            <button
              onClick={handleDeleteProfile}
              disabled={profiles.length <= 1}
              className="px-3 py-1.5 rounded-md border border-destructive/40 text-xs text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
            >
              Delete Current
            </button>
          </div>
          {profileActionMessage && (
            <div className={`rounded-md border px-3 py-2 text-xs ${profileActionType === "warning" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"}`}>
              {profileActionMessage}
            </div>
          )}
        </div>

        {/* ── Two-column grid ── */}
        <div className="grid grid-cols-2 gap-5 items-start slg:grid-cols-1">

          {/* ── LEFT COLUMN: Credentials ── */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-4 flex flex-col gap-5">

            {/* P12 Certificate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <FileKey2 className="w-4 h-4 text-primary" /> P12 / PFX Certificate
              </label>
              <p className="text-xs text-muted-foreground">
                Your certificate is saved in your browser so you don't have to re-upload it every time.
              </p>
              <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition">
                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {p12FileName
                    ? <span className="text-foreground">{p12FileName}</span>
                    : <span className="text-muted-foreground">Click to upload P12/PFX file</span>}
                </span>
                <input type="file" accept=".p12,.pfx" className="hidden" onChange={handleP12Change} />
              </label>
              {p12Loaded && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Certificate saved in browser storage
                </p>
              )}
            </div>

            {/* P12 password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">P12 / PFX Password</label>
              <p className="text-xs text-muted-foreground">Saved locally so you don't have to retype it every time.</p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter P12 password"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Display Name</label>
              <p className="text-xs text-muted-foreground">Name that appears on the signed PDF.</p>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>

            {/* Position */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Position / Title</label>
              <p className="text-xs text-muted-foreground">Shown as a subtitle on the signature box.</p>
              <input value={position} onChange={e => setPosition(e.target.value)}
                placeholder="e.g. Chief of Staff"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>

            {/* "Digitally Signed by: " checkbox */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Stamp Label</label>
              <label className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition select-none">
                <input type="checkbox" checked={showSignedBy} onChange={e => setShowSignedBy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground font-medium">Add "Digitally Signed by: " label</span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    Stamp will display:
                    <span className="block mt-1 font-mono text-foreground bg-accent rounded px-2 py-1 text-[11px] leading-relaxed">
                      Digitally Signed by: <br />
                      {displayName || "Your Name"}<br />
                      {position || "Your Position"}
                    </span>
                  </span>
                </div>
              </label>
            </div>

            {/* Signature image */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-primary" /> Signature Image
              </label>
              <p className="text-xs text-muted-foreground">Optional PNG/JPG image. Saved in browser storage.</p>
              <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition">
                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {signImageFile ? signImageFile.name : signImagePreview ? "signature.png (saved)" : "Click to upload signature image (PNG/JPG)"}
                </span>
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
              </label>
              {signImagePreview && (
                <div className="mt-2 flex items-start gap-3">
                  <div className="rounded-lg overflow-hidden border border-border w-48">
                    <img src={signImagePreview} alt="Signature preview" className="w-full h-auto" />
                  </div>
                  <button onClick={() => { setSignImagePreview(null); setSignImageFile(null); localStorage.removeItem("sig_image_data"); }}
                    className="p-1.5 rounded-lg border border-border hover:bg-accent transition text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>{/* end LEFT COLUMN */}

          {/* ── RIGHT COLUMN: Stamp Designer + Test Preview + Actions ── */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-4 flex flex-col gap-5">

            {/* Stamp designer */}
            {(displayName || signImagePreview) && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  Stamp Designer
                  <span className="text-xs text-muted-foreground font-normal">— drag image &amp; text to reposition</span>
                </label>

                <div className="flex gap-4 items-start sm:flex-col">

                  {/* Stamp preview box — zero padding, content fills edge-to-edge */}
                  <div className="shrink-0 flex flex-col gap-1">
                    <div
                      ref={stampDesRef}
                      className="relative border-2 border-blue-500 rounded-md bg-white overflow-hidden select-none"
                      style={{ width: designerW, height: designerH, padding: 0 }}
                    >
                      {signImagePreview && (
                        <img
                          src={signImagePreview}
                          alt="sig"
                          draggable={false}
                          className="absolute cursor-grab active:cursor-grabbing object-contain"
                          style={{
                            top:       `${imgTop}%`,
                            left:      `${imgLeft}%`,
                            transform: "translate(-50%, 0)",
                            width:     designerImgW,
                            maxWidth:  "100%",
                          }}
                          onMouseDown={e => { e.preventDefault(); setDragging("img"); }}
                          onTouchStart={e => { e.preventDefault(); setDragging("img"); }}
                        />
                      )}

                      <div
                        className="absolute text-left cursor-grab active:cursor-grabbing"
                        style={{ top: `${txtTop}%`, left: `${txtLeft}%`, whiteSpace: "nowrap", lineHeight: 1.2 }}
                        onMouseDown={e => { e.preventDefault(); setDragging("txt"); }}
                        onTouchStart={e => { e.preventDefault(); setDragging("txt"); }}
                      >
                        {showSignedBy && (
                          <p className="leading-tight" style={{ fontSize: designerSignedBySize, color: signedByColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                            Digitally Signed by:
                          </p>
                        )}
                        {displayName && getDisplayNameLines(displayName).map((line, i) => (
                          <p key={i} className="leading-tight" style={{ fontSize: designerNameSize, color: nameColor, fontFamily, fontStyle: isItalic ? "italic" : "normal", fontWeight: isBold ? "bold" : "normal" }}>
                            {line}
                          </p>
                        ))}
                        {position && (
                          <p className="leading-tight" style={{ fontSize: designerPosSize, color: positionColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                            {position}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MousePointer2 className="w-3 h-3" />
                      Drag to reposition — <span className="font-semibold">Save Settings</span> to keep
                    </p>
                  </div>

                  {/* Sliders — all proportional (% of stamp dims) */}
                  <div className="flex flex-col sm:w-full gap-3 flex-1 min-w-0">

                    {/* Lock ratio toggle */}
                    <button
                      onClick={handleLockRatio}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border transition self-start ${
                        lockRatio
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {lockRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {lockRatio ? "Ratio locked" : "Lock aspect ratio"}
                    </button>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-primary" /> Text Size
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{textSizePct}% of height</span>
                      </label>
                      <input type="range" min={5} max={50} step={1} value={textSizePct}
                        onChange={e => setTextSizePct(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>5%</span><span>50%</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" /> Image Width
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{imgWidthPct}% of stamp</span>
                      </label>
                      <input type="range" min={5} max={100} step={1} value={imgWidthPct}
                        onChange={e => setImgWidthPct(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>5%</span><span>100%</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Default Stamp Width
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{stampWidth} pt</span>
                      </label>
                      <input type="range" min={10} max={420} step={1} value={stampWidth}
                        onChange={e => handleStampWidthChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Default Stamp Height
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{stampHeight} pt</span>
                      </label>
                      <input type="range" min={10} max={220} step={1} value={stampHeight}
                        onChange={e => handleStampHeightChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </div>

                    {/* Font family */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Font Family</label>
                      <div className="relative" ref={fontDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setFontDropdownOpen(v => !v)}
                          className="w-full flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                        >
                          <span style={{ fontFamily }}>
                            {FONT_OPTIONS.find(f => f.value === fontFamily)?.label ?? fontFamily}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2 transition-transform ${fontDropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                        {fontDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg overflow-hidden">
                            {FONT_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => { setFontFamily(opt.value); setFontDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition ${fontFamily === opt.value ? "bg-primary/10 text-primary" : "text-foreground"}`}
                                style={{ fontFamily: opt.value }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                    {/* Italic + Bold toggles */}
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                      <input type="checkbox" checked={isBold} onChange={e => setIsBold(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary cursor-pointer" />
                      <span className="text-xs text-foreground">Bold</span>
                      {isBold && (
                        <span className="text-xs text-muted-foreground font-semibold">(name will be bold)</span>
                      )}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                      <input type="checkbox" checked={isItalic} onChange={e => setIsItalic(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary cursor-pointer" />
                      <span className="text-xs text-foreground">Italic</span>
                      {isItalic && (
                        <span className="text-xs text-muted-foreground italic">(all text will be italicised)</span>
                      )}
                    </label>
                    </div>

                    {/* Text colors */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Text Colors</label>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-muted-foreground">Name</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted-foreground">{nameColor}</span>
                            <input type="color" value={nameColor} onChange={e => setNameColor(e.target.value)}
                              className="w-7 h-7 rounded border border-border cursor-pointer p-0.5 bg-background" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs text-muted-foreground">Position</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted-foreground">{positionColor}</span>
                            <input type="color" value={positionColor} onChange={e => setPositionColor(e.target.value)}
                              className="w-7 h-7 rounded border border-border cursor-pointer p-0.5 bg-background" />
                          </div>
                        </div>
                        {showSignedBy && (
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">"Signed by" label</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-muted-foreground">{signedByColor}</span>
                              <input type="color" value={signedByColor} onChange={e => setSignedByColor(e.target.value)}
                                className="w-7 h-7 rounded border border-border cursor-pointer p-0.5 bg-background" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* ── Test Sign Preview ── */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" /> Test Sign Preview
                <span className="text-xs text-muted-foreground font-normal">— drag to draw stamp box on PDF</span>
              </label>

              {!testPdfDoc && (
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {testPdfLoading ? "Loading PDF…" : testPdfFile ? testPdfFile.name : "Click to upload a sample PDF"}
                  </span>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleTestPdfChange} />
                </label>
              )}
              {testPdfError && <p className="text-xs text-destructive">{testPdfError}</p>}

              {testPdfDoc && (
                <div className="flex flex-col gap-2">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {drawState === "placed" && !testBaked && (
                      <button onClick={() => { setDrawState("idle"); setTestBaked(null); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition">
                        <X className="w-3 h-3" /> Redraw
                      </button>
                    )}
                    {drawState === "placed" && !testBaked && (
                      <button onClick={handleBakePreview} disabled={testBaking}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">
                        {testBaking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        {testBaking ? "Rendering…" : "Bake Preview"}
                      </button>
                    )}
                    {testBaked && (
                      <button onClick={() => { setTestBaked(null); setDrawState("idle"); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition">
                        <X className="w-3 h-3" /> Reset
                      </button>
                    )}
                    {testPdfDoc && testPdfDoc.numPages > 1 && (
                      <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                        <button disabled={testPage <= 1} onClick={() => setTestPage(p => p - 1)}
                          className="px-2 py-0.5 rounded border border-input disabled:opacity-40 hover:bg-muted transition">←</button>
                        <span>pg {testPage}/{testPdfDoc.numPages}</span>
                        <button disabled={testPage >= testPdfDoc.numPages} onClick={() => setTestPage(p => p + 1)}
                          className="px-2 py-0.5 rounded border border-input disabled:opacity-40 hover:bg-muted transition">→</button>
                      </div>
                    )}
                    {/* Zoom controls */}
                    <div className="flex items-center gap-0.5 ml-auto">
                      <button onClick={handleTestZoomOut} disabled={testZoomLevel <= 0.5}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Zoom out">
                        <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <span className="text-xs text-muted-foreground font-mono select-none w-10 text-center">
                        {Math.round(testZoomLevel * 100)}%
                      </span>
                      <button onClick={handleTestZoomIn} disabled={testZoomLevel >= 3.0}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 transition" title="Zoom in">
                        <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <button onClick={() => { setTestPdfFile(null); setTestPdfDoc(null); setDrawState("idle"); setDrawRect(null); setTestBaked(null); }}
                      className="ml-auto p-1.5 rounded-md border border-border hover:bg-accent transition text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Baked result */}
                  {testBaked && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Stamp preview — this is roughly how it will look in the signed PDF
                      </p>
                      <img src={testBaked} alt="baked preview" className="w-full rounded border border-border" />
                    </div>
                  )}

                  {/* Live canvas + overlay */}
                  {!testBaked && (
                    <div ref={outerTestContainerRef} className="overflow-x-auto border border-border rounded bg-gray-100">
                    <div ref={testContainerRef} className="relative" style={{ width: "max-content", minWidth: "100%" }}>
                      {testPdfLoading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading PDF…
                        </div>
                      )}
                      <canvas ref={testCanvasRef} className="block" />

                      {/* ── Draw overlay: idle or drawing ── */}
                      {(drawState === "idle" || drawState === "drawing") && (
                        <div
                          className="absolute inset-0 select-none"
                          style={{ cursor: "crosshair", zIndex: 10 }}
                          onMouseDown={handleOverlayMouseDown}
                          onMouseMove={handleOverlayMouseMove}
                          onMouseUp={handleOverlayMouseUp}
                        >
                          {drawState === "idle" && (
                            <div className="absolute top-0 inset-x-0 bg-blue-600/90 text-white text-xs px-3 py-1.5 pointer-events-none flex items-center gap-1.5">
                              <MousePointer2 className="w-3 h-3" />
                              Click and drag to draw the stamp area
                              {lockRatio && <span className="ml-2 opacity-75">· ratio locked {Math.round(lockedRatio.current * 100) / 100}:1</span>}
                            </div>
                          )}

                          {/* Live draw rubber-band */}
                          {drawState === "drawing" && drawRect && (
                            <>
                              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                              <div
                                className="absolute border-2 border-blue-500 rounded pointer-events-none overflow-hidden"
                                style={{
                                  left: drawRect.left, top: drawRect.top,
                                  width: drawRect.width, height: drawRect.height,
                                  background: "rgba(59,130,246,0.12)",
                                }}
                              >
                                {/* Live content preview inside rubber-band */}
                                {signImagePreview && drawRect.width > 20 && (
                                  <img src={signImagePreview} alt="sig" className="absolute object-contain pointer-events-none"
                                    style={{
                                      top:  `${imgTop}%`,
                                      left: `${imgLeft}%`,
                                      transform: "translate(-50%,0)",
                                      width: `${imgWidthPct}%`,
                                      maxWidth: "100%",
                                    }} />
                                )}
                                {drawRect.width > 40 && drawRect.height > 20 && (
                                  <div className="absolute text-left pointer-events-none"
                                    style={{ top: `${txtTop}%`, left: `${txtLeft}%`, whiteSpace: "nowrap", lineHeight: 1.2 }}>
                                    {showSignedBy && (
                                      <p style={{ fontSize: Math.max(0.01, (textSizePct / 100) * 0.667 * drawRect.height), color: signedByColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                                        Digitally Signed by:
                                      </p>
                                    )}
                                    {getDisplayNameLines(displayName).map((line, i) => (
                                      <p key={i} className="" style={{ fontSize: Math.max(0.01, (textSizePct / 100) * drawRect.height), color: nameColor, fontFamily, fontStyle: isItalic ? "italic" : "normal", fontWeight: isBold ? "bold" : "normal" }}>
                                        {line}
                                      </p>
                                    ))}
                                    {position && (
                                      <p style={{ fontSize: Math.max(0.01, (textSizePct / 100) * 0.833 * drawRect.height), color: positionColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                                        {position}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {/* Size hint */}
                                <div className="absolute bottom-0.5 right-1 text-[9px] text-blue-600 font-mono pointer-events-none">
                                  {Math.round(drawRect.width / testRenderScale)}×{Math.round(drawRect.height / testRenderScale)} pt
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Placed stamp with move/resize handles ── */}
                      {drawState === "placed" && placedStampCss && (() => {
                        const { cssLeft, cssTop, cssW, cssH } = placedStampCss;
                        const HANDLE = 16;
                        return (
                          <div
                            className="absolute border-2 border-blue-500 rounded overflow-hidden select-none"
                            style={{
                              left: cssLeft, top: cssTop, width: cssW, height: cssH,
                              background: "rgba(59,130,246,0.07)", zIndex: 5,
                            }}
                          >
                            {/* Content — proportional, no padding */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              {signImagePreview && (
                                <img src={signImagePreview} alt="sig" className="absolute object-contain"
                                  style={{
                                    top:  `${imgTop}%`,
                                    left: `${imgLeft}%`,
                                    transform: "translate(-50%,0)",
                                    width: `${imgWidthPct}%`,
                                    maxWidth: "100%",
                                  }} />
                              )}
                              <div className="absolute text-left"
                                style={{ top: `${txtTop}%`, left: `${txtLeft}%`, whiteSpace: "nowrap", lineHeight: 1.2 }}>
                                {showSignedBy && (
                                  <p style={{ fontSize: Math.max(0.01, (textSizePct / 100) * 0.667 * cssH), color: signedByColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                                    Digitally Signed by:
                                  </p>
                                )}
                                {getDisplayNameLines(displayName).map((line, i) => (
                                  <p key={i} className="" style={{ fontSize: Math.max(0.01, (textSizePct / 100) * cssH), color: nameColor, fontFamily, fontStyle: isItalic ? "italic" : "normal", fontWeight: isBold ? "bold" : "normal" }}>
                                    {line}
                                  </p>
                                ))}
                                {position && (
                                  <p style={{ fontSize: Math.max(0.01, (textSizePct / 100) * 0.833 * cssH), color: positionColor, fontFamily, fontStyle: isItalic ? "italic" : "normal" }}>
                                    {position}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Move handle — top-left */}
                            <div
                              title="Drag to move"
                              className="absolute top-0 left-0 flex items-center justify-center bg-blue-600/80 hover:bg-blue-700 cursor-move z-10 rounded-br"
                              style={{ width: HANDLE, height: HANDLE }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                movingStamp.current = { startX: e.clientX, startY: e.clientY, origX: testSigX, origY: testSigY };
                              }}
                            >
                              <span style={{ fontSize: 8, color: "white", userSelect: "none" }}>✥</span>
                            </div>

                            {/* Resize handle — bottom-right */}
                            <div
                              title="Drag to resize"
                              className="absolute bottom-0 right-0 flex items-center justify-center bg-blue-600/80 hover:bg-blue-700 cursor-se-resize z-10 rounded-tl"
                              style={{ width: HANDLE, height: HANDLE }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                resizingStamp.current = { startX: e.clientX, startY: e.clientY, origW: testBoxW, origH: testBoxH, origY: testSigY };
                              }}
                            >
                              <span style={{ fontSize: 9, color: "white", userSelect: "none" }}>⌟</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    </div>
                  )}

                  {drawState === "placed" && !testBaked && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="font-mono text-blue-500 text-lg">✥</span> top-left to move &nbsp;·&nbsp;
                      <span className="font-mono text-blue-500">⌟</span> bottom-right to resize &nbsp;·&nbsp;
                      click <span className="font-semibold ml-1">Bake Preview</span> to render
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleClear}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
                Clear All
              </button>
              <button onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
              </button>
            </div>

          </div>{/* end RIGHT COLUMN */}
        </div>
      </div>
    </UserLayout>
  );
};

export default SignatureSettings;