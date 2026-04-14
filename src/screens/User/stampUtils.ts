/**
 * stampUtils.ts
 * ─────────────
 * Shared stamp-rendering helpers used by:
 *   • SignatureSettings  – live designer preview + "Bake Preview" canvas
 *   • SignDocument       – building the final `sign_design` PNG blob sent to
 *                          the Flask /sign-pdf endpoint
 *
 * The backend (pnpki_local.py) accepts an optional `sign_design` multipart
 * field.  When present it is used as the *entire* visual of the signature
 * box – text rendered by pyhanko is suppressed.  We therefore bake every
 * visual element (signature image, name, position, "Digitally Signed by"
 * label) into a single high-resolution PNG here on the client, so the
 * backend has nothing extra to do.
 *
 * Coordinate conventions
 * ──────────────────────
 * All "ratio" values are fractions of the stamp box (0 – 1 / 0 – 100 for
 * the pct variants).  The backend converts the stamp box position to PDF
 * point space using x_ratio / y_ratio / w_ratio / h_ratio of the *page*.
 *
 * PUBLIC API
 * ──────────
 * buildStampBlob(opts)          → Promise<Blob>   PNG ready for FormData
 * buildStampDataUrl(opts)       → Promise<string> data:image/png;base64,…
 * getStampOptsFromStorage()     → StampOpts       read persisted settings
 */

export interface StampOpts {
  /** base64 data-URL of the user's signature image, or null */
  signImagePreview: string | null;

  /** image position inside stamp box (% of box dims, top-left origin) */
  imgTop:      number;  // 0 – 100
  imgLeft:     number;  // 0 – 100
  /** image width as % of stamp width */
  imgWidthPct: number;  // 0 – 100

  /** text block position inside stamp box (% of box dims) */
  txtTop:  number;  // 0 – 100
  txtLeft: number;  // 0 – 100

  showSignedBy: boolean;
  displayName:  string;
  position:     string;

  /** Font family for all stamp text (CSS font-family string) */
  fontFamily?:     string;
  /** Italicise all stamp text */
  isItalic?:       boolean;
  /** Bold the display name text */
  isBold?:         boolean;
  /** Color of the display name text */
  nameColor?:      string;
  /** Color of the position/title text */
  positionColor?:  string;
  /** Color of the "Digitally Signed by:" label */
  signedByColor?:  string;

  /**
   * Text size as a fraction of stamp *height* (0 – 1).
   * Stored in localStorage as 0–100 (textSizePct); divide by 100 when
   * passing here.
   */
  textSizePct: number;  // 0 – 1

  /**
   * Render resolution in pixels.
   * We bake at (stampWidthPt * RENDER_SCALE) × (stampHeightPt * RENDER_SCALE)
   * so the PNG is crisp when scaled into the PDF by pyhanko.
   * Defaults to 4 (= 288 dpi equivalent for a 72 dpi PDF).
   */
  renderScale?: number;

  /** Stamp box size in PDF points — used to set canvas pixel dimensions */
  stampWidthPt:  number;
  stampHeightPt: number;
}

/**
 * Read all stamp-related settings from localStorage and return a StampOpts
 * object ready to pass to buildStampBlob / buildStampDataUrl.
 */
export function getStampOptsFromStorage(): StampOpts {
  const n = (key: string, fallback: number) =>
    Number(localStorage.getItem(key) ?? fallback) || fallback;
  const s = (key: string, fallback = "") =>
    localStorage.getItem(key) ?? fallback;

  return {
    signImagePreview: s("sig_image_data") || null,
    imgTop:       n("sig_img_top",            5),
    imgLeft:      n("sig_img_left",          50),
    imgWidthPct:  n("sig_image_width_pct",   35),
    txtTop:       n("sig_txt_top",           55),
    txtLeft:      n("sig_txt_left",          50),
    showSignedBy: s("sig_show_signed_by") === "true",
    displayName:  s("sig_displayName"),
    position:     s("sig_position"),
    textSizePct:  n("sig_text_size_pct",     18) / 100,
    stampWidthPt:  n("sig_stamp_width",     140),
    stampHeightPt: n("sig_stamp_height",     50),
    fontFamily:    s("sig_font_family",  "Inter, sans-serif"),
    isItalic:      s("sig_is_italic") === "true",
    isBold:        s("sig_is_bold") !== "false",
    nameColor:     s("sig_name_color",   "#1e3a5f"),
    positionColor: s("sig_pos_color",    "#2563eb"),
    signedByColor: s("sig_signed_by_color", "#64748b"),
  };
}

// ─── internal ─────────────────────────────────────────────────────────────────

function splitDisplayName(name: string): string[] {
  return name ? name.split(/<br\s*\/?>(?![^<]*>)/i) : [""];
}

/**
 * Draw stamp content (image + text) into an existing 2-D canvas context
 * that is already sized to W × H pixels.
 *
 * The canvas background is transparent so pyhanko (or any PDF renderer)
 * can composite it naturally over the page content.
 */
function _draw(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  opts: StampOpts,
): Promise<void> {
  return new Promise((resolve) => {
    const {
      signImagePreview, imgTop, imgLeft, imgWidthPct,
      txtTop, txtLeft, showSignedBy, displayName, position, textSizePct,
      fontFamily    = "Inter, sans-serif",
      isItalic      = false,
      isBold        = true,
      nameColor     = "#1e3a5f",
      positionColor = "#2563EB",
      signedByColor = "#64748b",
    } = opts;

    // Font sizes are proportional to stamp height
    const nameFs     = Math.max(0.01, textSizePct         * H);
    const posFs      = Math.max(0.01, textSizePct * 0.833 * H);
    const signedByFs = Math.max(0.01, textSizePct * 0.667 * H);

    const drawText = () => {
      const tx = (txtLeft / 100) * W;
      const ty = (txtTop  / 100) * H;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";

      let nameY = ty;
      if (showSignedBy) {
        ctx.font      = `${isItalic ? "italic " : ""}${signedByFs}px ${fontFamily}`;
        ctx.fillStyle = signedByColor;
        ctx.fillText("Digitally Signed by: ", tx, ty);
        nameY = ty + signedByFs * 1.4;
      }

      const nameLines = splitDisplayName(displayName);
      if (displayName) {
        ctx.font      = `${isItalic ? "italic " : ""}${isBold ? "bold " : ""}${nameFs}px ${fontFamily}`;
        ctx.fillStyle = nameColor;
        nameLines.forEach((line, i) => {
          ctx.fillText(line, tx, nameY + i * nameFs * 1.3);
        });
      }

      if (position) {
        ctx.font      = `${isItalic ? "italic " : ""}${posFs}px ${fontFamily}`;
        ctx.fillStyle = positionColor;
        ctx.fillText(position, tx, nameY + nameLines.length * nameFs * 1.3);
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
        resolve();
      };
      img.onerror = () => { drawText(); resolve(); };
      img.src = signImagePreview;
    } else {
      drawText();
      resolve();
    }
  });
}

// ─── public ───────────────────────────────────────────────────────────────────

/**
 * Render the stamp into an off-screen canvas and return a PNG data-URL.
 * Used by SignatureSettings for the "Bake Preview" feature.
 */
export async function buildStampDataUrl(opts: StampOpts): Promise<string> {
  const scale = opts.renderScale ?? 4;
  const W = Math.round(opts.stampWidthPt  * scale);
  const H = Math.round(opts.stampHeightPt * scale);

  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // transparent background — pyhanko composites over the page
  ctx.clearRect(0, 0, W, H);

  await _draw(ctx, W, H, opts);
  return canvas.toDataURL("image/png");
}

/**
 * Render the stamp and return a PNG Blob.
 * Used by SignDocument to build the `sign_design` FormData field that is
 * sent to the Flask /sign-pdf endpoint.
 *
 * The Flask backend (pnpki_local.py) handles `sign_design` like this:
 *
 *   sign_design_file = request.files.get("sign_design")
 *   if sign_design_file:
 *       img_obj = PIL.Image.open(io.BytesIO(design_bytes)).convert("RGBA")
 *       custom_stamp_style = TextStampStyle(
 *           stamp_text=" ",
 *           background=pdf_images.PdfImage(img_obj),
 *           background_opacity=1.0,
 *           border_width=0,
 *       )
 *
 * So stamp_text is suppressed (" ") and the PNG we send here is the sole
 * visual of the signature field.  Transparency is preserved by RGBA.
 */
export async function buildStampBlob(opts: StampOpts): Promise<Blob> {
  const dataUrl = await buildStampDataUrl(opts);
  const res     = await fetch(dataUrl);
  return res.blob();
}

/**
 * Convert a stamp-box position on a rendered PDF canvas into the ratio
 * parameters expected by the Flask /sign-pdf endpoint.
 *
 * @param sigX        PDF point x of stamp left edge
 * @param sigY        PDF point y of stamp bottom edge  (PDF bottom-origin)
 * @param boxW        stamp box width  in PDF points
 * @param boxH        stamp box height in PDF points
 * @param pageWidth   PDF page width  in PDF points
 * @param pageHeight  PDF page height in PDF points
 *
 * Returns { x_ratio, y_ratio, w_ratio, h_ratio } where y_ratio is from
 * the *top* of the page (as the Flask server converts top-origin → bottom-
 * origin internally).
 */
export function stampBoxToRatios(
  sigX: number, sigY: number,
  boxW: number, boxH: number,
  pageWidth: number, pageHeight: number,
): { x_ratio: number; y_ratio: number; w_ratio: number; h_ratio: number } {
  // sigY is bottom of box in PDF space (bottom-origin).
  // The Flask server expects y_ratio measured from the top:
  //   bottom = page_h - (y_ratio * page_h) - box_h
  //   → y_ratio = (page_h - sigY - boxH) / page_h
  return {
    x_ratio: sigX / pageWidth,
    y_ratio: (pageHeight - sigY - boxH) / pageHeight,
    w_ratio: boxW  / pageWidth,
    h_ratio: boxH  / pageHeight,
  };
}