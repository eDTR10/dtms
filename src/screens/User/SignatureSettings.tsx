import { useState, useRef, useEffect, useCallback } from "react";
import { Key, Upload, Save, CheckCircle2, FileKey2, Type, Image as ImageIcon, Trash2, MousePointer2, FileText, X, Loader2, Eye } from "lucide-react";
import UserLayout from "./UserLayout";
import { useAuth } from "../Auth/AuthContext";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;

/**
 * Signature Settings — all data is stored in localStorage ONLY.
 * Nothing is sent to the server.
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

// Keep designer proportions tied to the same logical stamp box used in signing.
const STAMP_BOX_W = 140;
const STAMP_BOX_H = 50;
const DESIGNER_BASE_W = 330;

const SignatureSettings = () => {
  const { user } = useAuth();

  const [password, setPassword]         = useState(localStorage.getItem("sig_password")    || "");
  const [displayName, setDisplayName]   = useState(localStorage.getItem("sig_displayName") || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim());
  const [position, setPosition]         = useState(localStorage.getItem("sig_position")    || user?.position || "");
  const [textSize, setTextSize]         = useState(Number(localStorage.getItem("sig_text_size"))    || 12);
  const [imgWidth, setImgWidth]         = useState(Number(localStorage.getItem("sig_image_width")) || 150);
  const [stampWidth, setStampWidth]     = useState(Number(localStorage.getItem("sig_stamp_width")) || STAMP_BOX_W);
  const [stampHeight, setStampHeight]   = useState(Number(localStorage.getItem("sig_stamp_height")) || STAMP_BOX_H);

  // "Digitally Signed by: " label toggle
  const [showSignedBy, setShowSignedBy] = useState(localStorage.getItem("sig_show_signed_by") === "true");

  const [signImagePreview, setSignImagePreview] = useState<string | null>(localStorage.getItem("sig_image_data") || null);
  const [signImageFile, setSignImageFile]       = useState<File | null>(null);

  const [p12FileName, setP12FileName] = useState<string>(localStorage.getItem("sig_p12_name") || "");
  const [p12Loaded, setP12Loaded]     = useState(!!localStorage.getItem("sig_p12_data"));

  const [saved, setSaved] = useState(false);

  // Stamp layout — % position of element center (top-left origin) synced with SignDocument
  const [imgTop,   setImgTop]   = useState(Number(localStorage.getItem("sig_img_top"))   || 5);
  const [imgLeft,  setImgLeft]  = useState(Number(localStorage.getItem("sig_img_left"))  || 50);
  const [txtTop,   setTxtTop]   = useState(Number(localStorage.getItem("sig_txt_top"))   || 55);
  const [txtLeft,  setTxtLeft]  = useState(Number(localStorage.getItem("sig_txt_left"))  || 50);
  const [dragging, setDragging] = useState<null | "img" | "txt">(null);
  const stampDesRef = useRef<HTMLDivElement>(null);

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
  const [testPlacing,   setTestPlacing]   = useState(false);
  const [testPlaced,    setTestPlaced]    = useState(false);
  const [testHoverPx,   setTestHoverPx]   = useState<{left:number;top:number}|null>(null);
  const [testBaked,     setTestBaked]     = useState<string|null>(null);
  const [testBaking,    setTestBaking]    = useState(false);
  const testCanvasRef     = useRef<HTMLCanvasElement>(null);
  const testContainerRef  = useRef<HTMLDivElement>(null);
  const testRenderTaskRef = useRef<any>(null);
  const testDraggingStamp = useRef<{startX:number;startY:number;origX:number;origY:number}|null>(null);
  const testResizingStamp = useRef<{startX:number;startY:number;origW:number;origH:number;origY:number}|null>(null);

  // Convert persisted stamp settings to designer-space pixels for a true WYSIWYG preview.
  const designerScale        = DESIGNER_BASE_W / Math.max(1, stampWidth);
  const designerW            = DESIGNER_BASE_W;
  const designerH            = Math.max(60, Math.round(stampHeight * designerScale));
  const designerImageWidth   = Math.min((imgWidth / Math.max(1, stampWidth)) * designerW, designerW * 0.9);
  const designerNameSize     = Math.max(8, textSize * designerScale);
  const designerPosSize      = Math.max(8, (textSize - 2) * designerScale);
  const designerSignedBySize = Math.max(7, (textSize - 3) * designerScale);

  useEffect(() => {
    setTestBoxW(stampWidth);
    setTestBoxH(stampHeight);
    setTestBaked(null);
  }, [stampWidth, stampHeight]);

  const testRenderPage = useCallback(async (doc: any, pageNum: number) => {
    if (!testCanvasRef.current || !testContainerRef.current) return;
    if (testRenderTaskRef.current) {
      testRenderTaskRef.current.cancel();
      try { await testRenderTaskRef.current.promise; } catch (_) { /* RenderingCancelledException — expected */ }
      testRenderTaskRef.current = null;
    }
    const page = await doc.getPage(pageNum);
    const vp1  = page.getViewport({ scale: 1 });
    const cw   = testContainerRef.current.clientWidth || 600;
    const scale = cw / vp1.width;
    const vp   = page.getViewport({ scale });
    const canvas = testCanvasRef.current;
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const task = page.render({ canvasContext: ctx, viewport: vp });
    testRenderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err: any) {
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

  // Global move/up for test stamp drag + resize
  useEffect(() => {
    const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v));
    const onMove = (e: MouseEvent) => {
      if (testDraggingStamp.current) {
        const { startX, startY, origX, origY } = testDraggingStamp.current;
        const dx = (e.clientX - startX) / testRenderScale;
        const dy = (e.clientY - startY) / testRenderScale;
        setTestSigX(clamp(origX + dx, 0, testPageWidth  - testBoxW));
        setTestSigY(clamp(origY - dy, 0, testPageHeight - testBoxH));
      }
      if (testResizingStamp.current) {
        const { startX, startY, origW, origH, origY } = testResizingStamp.current;
        const dw = (e.clientX - startX) / testRenderScale;
        const dh = (e.clientY - startY) / testRenderScale;
        setTestBoxW(Math.round(clamp(origW + dw, 40, testPageWidth)));
        setTestBoxH(Math.round(clamp(origH + dh, 20, testPageHeight)));
        setTestSigY(clamp(origY - dh, 0, testPageHeight - 20));
      }
    };
    const onUp = () => { testDraggingStamp.current = null; testResizingStamp.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRenderScale, testPageWidth, testPageHeight, testBoxW, testBoxH]);

  const handleTestPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTestPdfFile(file);
    setTestPdfDoc(null);
    setTestPlaced(false);
    setTestPlacing(false);
    setTestBaked(null);
    setTestPdfError(null);
    setTestPdfLoading(true);
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

  const handleTestOverlay = (e: React.MouseEvent<HTMLDivElement>, isClick: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sc  = testRenderScale;
    const px  = e.clientX - rect.left;
    const py  = e.clientY - rect.top;
    const sw  = testBoxW * sc;
    const sh  = testBoxH * sc;
    const left = Math.max(0, Math.min(rect.width  - sw, px - sw / 2));
    const top  = Math.max(0, Math.min(rect.height - sh, py - sh / 2));
    if (isClick) {
      setTestSigX(Math.max(0, Math.min(testPageWidth  - testBoxW, px / sc - testBoxW / 2)));
      setTestSigY(Math.max(0, Math.min(testPageHeight - testBoxH, testPageHeight - py / sc - testBoxH / 2)));
      setTestPlaced(true);
      setTestPlacing(false);
      setTestHoverPx(null);
      setTestBaked(null);
    } else {
      setTestHoverPx({ left, top });
    }
  };

  /** Bake composite stamp image onto a copy of the PDF canvas and show it as a data-URL preview */
  const handleBakePreview = async () => {
    if (!testPdfDoc || !testCanvasRef.current) return;
    setTestBaking(true);
    try {
      const W  = 1000;
      const H  = Math.max(160, Math.round(W * (testBoxH / testBoxW)));
      const stampCv = document.createElement("canvas");
      stampCv.width = W; stampCv.height = H;
      const sCtx = stampCv.getContext("2d")!;
      const ptToPx      = H / testBoxH;
      const nameFs      = textSize * ptToPx;
      const posFs       = Math.max(6, textSize - 2) * ptToPx;
      const signedByFs  = Math.max(5, textSize - 3) * ptToPx;

      const drawStampText = () => {
        const ty   = (txtTop / 100) * H;
        const xPos = (txtLeft / 100) * W;// fixed left padding in canvas pixels
        // LEFT-aligned text
        sCtx.textAlign    = "left";
        sCtx.textBaseline = "top";

        let nameOffsetY = ty;
        if (showSignedBy) {
          sCtx.font      = `${signedByFs}px sans-serif`;
          sCtx.fillStyle = "#64748b";
          sCtx.fillText("Digitally Signed by: ", xPos, ty);
          nameOffsetY = ty + signedByFs * 1.4;
        }

        if (displayName) {
          sCtx.font      = `bold ${nameFs}px sans-serif`;
          sCtx.fillStyle = "#1e3a5f";
          sCtx.fillText(displayName, xPos, nameOffsetY);
        }
        if (position) {
          sCtx.font      = `${posFs}px sans-serif`;
          sCtx.fillStyle = "#2563EB";
          sCtx.fillText(position, xPos, nameOffsetY + nameFs * 1.35);
        }
      };

      await new Promise<void>(resolve => {
        if (signImagePreview) {
          const img = new Image();
          img.onload = () => {
            const iw = (imgWidth / testBoxW) * W;
            const ih = img.naturalHeight * (iw / Math.max(1, img.naturalWidth));
            const ix = (imgLeft / 100) * W - iw / 2;
            const iy = (imgTop  / 100) * H;
            sCtx.drawImage(img, ix, iy, iw, ih);
            drawStampText();
            resolve();
          };
          img.onerror = () => { drawStampText(); resolve(); };
          img.src = signImagePreview;
        } else {
          drawStampText();
          resolve();
        }
      });

      const pdfCv  = testCanvasRef.current;
      const outCv  = document.createElement("canvas");
      outCv.width  = pdfCv.width;
      outCv.height = pdfCv.height;
      const oCtx   = outCv.getContext("2d")!;
      oCtx.drawImage(pdfCv, 0, 0);

      const cssLeft = testSigX       * testRenderScale;
      const cssTop  = (testPageHeight - testSigY - testBoxH) * testRenderScale;
      const cssW    = testBoxW * testRenderScale;
      const cssH    = testBoxH * testRenderScale;
      oCtx.drawImage(stampCv, cssLeft, cssTop, cssW, cssH);

      setTestBaked(outCv.toDataURL("image/png"));
    } finally {
      setTestBaking(false);
    }
  };

  // Mouse and touch drag handler for stamp designer
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !stampDesRef.current) return;
      let clientX: number, clientY: number;
      if (e instanceof TouchEvent) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        // Prevent scrolling while dragging
        if (dragging) e.preventDefault();
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rect = stampDesRef.current.getBoundingClientRect();
      const pctX = Math.max(5, Math.min(95, ((clientX - rect.left)  / rect.width)  * 100));
      const pctY = Math.max(0, Math.min(88, ((clientY - rect.top)   / rect.height) * 100));
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
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSignImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleP12Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setP12FileName(file.name);
    setP12Loaded(false);
    try {
      const b64 = await fileToBase64(file);
      localStorage.setItem("sig_p12_data", b64);
      localStorage.setItem("sig_p12_name", file.name);
      setP12Loaded(true);
    } catch {
      alert("Failed to read P12 file.");
    }
  };

  const handleSave = () => {
    localStorage.setItem("sig_password",        password);
    localStorage.setItem("sig_displayName",     displayName);
    localStorage.setItem("sig_position",        position);
    localStorage.setItem("sig_text_size",       String(textSize));
    localStorage.setItem("sig_image_width",     String(imgWidth));
    localStorage.setItem("sig_stamp_width",     String(stampWidth));
    localStorage.setItem("sig_stamp_height",    String(stampHeight));
    localStorage.setItem("sig_img_top",         String(imgTop));
    localStorage.setItem("sig_img_left",        String(imgLeft));
    localStorage.setItem("sig_txt_top",         String(txtTop));
    localStorage.setItem("sig_txt_left",        String(txtLeft));
    localStorage.setItem("sig_show_signed_by",  String(showSignedBy));
    if (signImagePreview) {
      localStorage.setItem("sig_image_data", signImagePreview);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    [
      "sig_password","sig_displayName","sig_position","sig_image_data",
      "sig_p12_data","sig_p12_name","sig_text_size","sig_image_width",
      "sig_stamp_width","sig_stamp_height",
      "sig_img_top","sig_img_left","sig_txt_top","sig_txt_left",
      "sig_show_signed_by",
    ].forEach(k => localStorage.removeItem(k));
    setPassword(""); setDisplayName(""); setPosition("");
    setSignImagePreview(null); setSignImageFile(null);
    setP12FileName(""); setP12Loaded(false);
    setTextSize(12); setImgWidth(150);
    setStampWidth(STAMP_BOX_W); setStampHeight(STAMP_BOX_H);
    setImgTop(5); setImgLeft(50); setTxtTop(55); setTxtLeft(50);
    setShowSignedBy(false);
  };

  return (
    <UserLayout title="Signature Settings" subtitle="Configure your personal digital signing credentials">

      <div className="flex flex-col gap-5">

        {/* Privacy notice — full width */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <Key className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Privacy Notice:</span> Your P12 certificate, password, and signing data are stored only in your browser's localStorage. They are never sent to or stored on the server.
          </p>
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
              <p className="text-xs text-muted-foreground">
                Optionally prepend a "Digitally Signed by: " label above your name on the stamp.
              </p>
              <label className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 cursor-pointer hover:border-primary/50 transition select-none">
                <input
                  type="checkbox"
                  checked={showSignedBy}
                  onChange={e => setShowSignedBy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                />
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
              <p className="text-xs text-muted-foreground">Optional PNG/JPG image used as the signature box background. Saved in browser storage.</p>
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
                  <span className="text-xs text-muted-foreground font-normal">— drag image &amp; text to position</span>
                </label>

                <div className="flex gap-4 items-start sm:flex-col">

                  {/* Stamp box */}
                  <div className="shrink-0">
                    <div
                      ref={stampDesRef}
                      className="relative border-2 border-blue-500 rounded-md bg-white overflow-hidden select-none"
                      style={{ width: designerW, height: designerH }}
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
                            width:     designerImageWidth,
                            maxWidth:  "90%",
                          }}
                          onMouseDown={e => { e.preventDefault(); setDragging("img"); }}
                          onTouchStart={e => { e.preventDefault(); setDragging("img"); }}
                        />
                      )}

                      {/* ── LEFT-ALIGNED text block ── */}
                      <div
                        className="absolute text-left cursor-grab active:cursor-grabbing"
                        style={{
                          top: `${txtTop}%`,
                          left: `${txtLeft}%`,
                          whiteSpace: "nowrap",
                          lineHeight: 1.25,
                        }}
                        onMouseDown={e => { e.preventDefault(); setDragging("txt"); }}
                        onTouchStart={e => { e.preventDefault(); setDragging("txt"); }}
                      >
                        {showSignedBy && (
                          <p className="text-slate-400 leading-tight px-1" style={{ fontSize: designerSignedBySize }}>
                            Digitally Signed by: 
                          </p>
                        )}
                        {displayName && (
                          <p className="font-bold text-blue-800 leading-tight px-1" style={{ fontSize: designerNameSize }}>
                            {displayName}
                          </p>
                        )}
                        {position && (
                          <p className="text-blue-600 leading-tight px-1" style={{ fontSize: designerPosSize }}>
                            {position}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MousePointer2 className="w-3 h-3" />
                      Drag image or text to reposition — click <span className="font-semibold">Save Settings</span> to keep
                    </p>
                  </div>

                  {/* Sliders */}
                  <div className="flex flex-col sm:w-full gap-4 flex-1 min-w-0">

                    <div className="flex flex-col gap-1.5  sm:w-full">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-primary" /> Text Size
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{textSize} pt</span>
                      </label>
                      <input type="range" min={4} max={24} step={1} value={textSize}
                        onChange={e => setTextSize(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>4pt</span><span>24pt</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" /> Image Width
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{imgWidth} px</span>
                      </label>
                      <input type="range" min={10} max={300} step={10} value={imgWidth}
                        onChange={e => setImgWidth(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>10px</span><span>300px</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Stamp Width
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{stampWidth} pt</span>
                      </label>
                      <input type="range" min={50} max={420} step={10} value={stampWidth}
                        onChange={e => setStampWidth(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>50pt</span><span>420pt</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Stamp Height
                        <span className="ml-auto font-mono bg-accent px-1.5 py-0.5 rounded text-[11px]">{stampHeight} pt</span>
                      </label>
                      <input type="range" min={20} max={220} step={5} value={stampHeight}
                        onChange={e => setStampHeight(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>20pt</span><span>220pt</span>
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
                <span className="text-xs text-muted-foreground font-normal">— upload a PDF to see your stamp on it</span>
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
                    {!testPlacing && (
                      <button
                        onClick={() => { setTestPlacing(true); setTestHoverPx(null); setTestBaked(null); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition">
                        <MousePointer2 className="w-3 h-3" /> Place Stamp
                      </button>
                    )}
                    {testPlacing && (
                      <button onClick={() => { setTestPlacing(false); setTestHoverPx(null); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {testPlaced && !testPlacing && (
                      <button onClick={handleBakePreview} disabled={testBaking}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">
                        {testBaking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        {testBaking ? "Rendering…" : "Bake Preview"}
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
                    <button onClick={() => { setTestPdfFile(null); setTestPdfDoc(null); setTestPlaced(false); setTestBaked(null); }}
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

                  {/* Live canvas */}
                  {!testBaked && (
                    <div ref={testContainerRef} className="relative w-full border border-border rounded overflow-hidden bg-gray-100">
                      {testPdfLoading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading PDF…
                        </div>
                      )}
                      <canvas ref={testCanvasRef} className="block w-full" />

                      {/* Placement overlay */}
                      {testPlacing && (
                        <div className="absolute inset-0 cursor-crosshair" style={{ zIndex: 10 }}
                          onMouseMove={e => handleTestOverlay(e, false)}
                          onMouseLeave={() => setTestHoverPx(null)}
                          onClick={e => handleTestOverlay(e, true)}>
                          <div className="absolute inset-0 bg-black/15 pointer-events-none" />
                          <div className="absolute top-0 inset-x-0 bg-blue-600/90 text-white text-xs px-3 py-1.5 pointer-events-none flex items-center gap-1.5">
                            <MousePointer2 className="w-3 h-3" /> Click to place stamp
                            {testHoverPx && <span className="ml-auto font-mono opacity-75">x:{Math.round(testSigX)} y:{Math.round(testSigY)}</span>}
                          </div>
                          {testHoverPx && (
                            <div className="absolute border-2 border-blue-400 rounded pointer-events-none overflow-hidden"
                              style={{
                                left: testHoverPx.left, top: testHoverPx.top,
                                width: testBoxW * testRenderScale, height: testBoxH * testRenderScale,
                                background: "rgba(59,130,246,0.15)",
                              }}>
                              {signImagePreview && (
                                <img src={signImagePreview} alt="sig" className="absolute object-contain pointer-events-none"
                                  style={{
                                    top: `${imgTop}%`, left: `${imgLeft}%`,
                                    transform: "translate(-50%,0)",
                                    width: imgWidth * testRenderScale, maxWidth: "90%",
                                  }} />
                              )}
                              {/* ── LEFT-ALIGNED hover ghost text ── */}
                              <div className="absolute text-left"
                                style={{
                                  top: `${txtTop}%`, left: `${txtLeft}%`,
                                  whiteSpace: "nowrap", lineHeight: 1.2,
                                }}>
                                {showSignedBy && (
                                  <p className="text-slate-500 truncate" style={{ fontSize: Math.max(6, (textSize - 3) * testRenderScale) }}>
                                    Digitally Signed by: 
                                  </p>
                                )}
                                <p className="font-bold text-blue-900 truncate" style={{ fontSize: Math.max(7, textSize * testRenderScale) }}>
                                  {displayName}
                                </p>
                                {position && (
                                  <p className="text-blue-700 truncate" style={{ fontSize: Math.max(6, (textSize - 2) * testRenderScale) }}>
                                    {position}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Confirmed stamp — small corner handles */}
                      {!testPlacing && testPlaced && (() => {
                        const cssLeft = testSigX * testRenderScale;
                        const cssTop  = (testPageHeight - testSigY - testBoxH) * testRenderScale;
                        const cssW    = testBoxW * testRenderScale;
                        const cssH    = testBoxH * testRenderScale;
                        const HANDLE  = 16;
                        return (
                          <div
                            className="absolute border-2 border-blue-500 rounded overflow-hidden select-none"
                            style={{
                              left: cssLeft, top: cssTop, width: cssW, height: cssH,
                              background: "rgba(59,130,246,0.08)", zIndex: 5, pointerEvents: "all",
                            }}
                          >
                            {/* Stamp content — full box, no padding offset */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              {signImagePreview && (
                                <img src={signImagePreview} alt="sig" className="absolute object-contain"
                                  style={{
                                    top: `${imgTop}%`, left: `${imgLeft}%`,
                                    transform: "translate(-50%,0)",
                                    width: imgWidth * testRenderScale, maxWidth: "90%",
                                  }} />
                              )}
                              {/* ── LEFT-ALIGNED confirmed stamp text ── */}
                              <div
                                className="absolute text-left"
                                style={{
                                  top: `${txtTop}%`, left: `${txtLeft}%`,
                                  whiteSpace: "nowrap", lineHeight: 1.2,
                                }}
                              >
                                {showSignedBy && (
                                  <p className="text-slate-500 truncate" style={{ fontSize: Math.max(6, (textSize - 3) * testRenderScale) }}>
                                    Digitally Signed by: 
                                  </p>
                                )}
                                <p className="font-bold text-blue-900 truncate" style={{ fontSize: Math.max(7, textSize * testRenderScale) }}>
                                  {displayName}
                                </p>
                                {position && (
                                  <p className="text-blue-700 truncate" style={{ fontSize: Math.max(6, (textSize - 2) * testRenderScale) }}>
                                    {position}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* TOP-LEFT: move handle */}
                            <div
                              title="Drag to move"
                              className="absolute top-0 left-0 flex items-center justify-center bg-blue-600/80 hover:bg-blue-700 cursor-move z-10 rounded-br"
                              style={{ width: HANDLE, height: HANDLE }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                testDraggingStamp.current = { startX: e.clientX, startY: e.clientY, origX: testSigX, origY: testSigY };
                              }}
                            >
                              <span style={{ fontSize: 8, color: "white", lineHeight: 1, userSelect: "none" }}>✥</span>
                            </div>

                            {/* BOTTOM-RIGHT: resize handle */}
                            <div
                              title="Drag to resize"
                              className="absolute bottom-0 right-0 flex items-center justify-center bg-blue-600/80 hover:bg-blue-700 cursor-se-resize z-10 rounded-tl"
                              style={{ width: HANDLE, height: HANDLE }}
                              onMouseDown={e => {
                                e.preventDefault(); e.stopPropagation();
                                testResizingStamp.current = { startX: e.clientX, startY: e.clientY, origW: testBoxW, origH: testBoxH, origY: testSigY };
                              }}
                            >
                              <span style={{ fontSize: 9, color: "white", lineHeight: 1, userSelect: "none" }}>⌟</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {testPlaced && !testPlacing && !testBaked && (
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
        </div>{/* end grid */}
      </div>{/* end outer flex */}
    </UserLayout>
  );
};

export default SignatureSettings;