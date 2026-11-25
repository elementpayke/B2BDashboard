/**
 * Payment receipt PDF for the send flow — drawn to match the on-screen
 * receipt (features/send/SendReceipt.tsx) line for line: same blocks, same
 * order, same spacing, same alignment and the same brand fonts.
 *
 * Units: 1 CSS px on the preview = 1 pt here. The preview card's content box
 * is 498px wide, which is what an A4 page leaves between 48.6pt margins.
 * Every offset below is the preview's Tailwind spacing written out in px.
 */

import { jsPDF } from "jspdf";
import { FONT_SIZE, LETTER_SPACING, THEME_LIGHT } from "@/lib/theme/tokens.generated";

export type SendReceiptRow = { label: string; value: string; mono?: boolean };

/** Everything the receipt shows. SendReceipt renders the same object. */
export type SendReceiptDoc = {
  pending: boolean;
  orderId: string | null;
  /** Already formatted, e.g. "25 Nov 2026, 17:15". */
  paidAt: string | null;
  statusText: string;
  sourceLabel: string;
  recipientName: string;
  toLines: string[];
  /** Description / Amount rows above the total. */
  rows: SendReceiptRow[];
  totalText: string;
  getsLabel: string;
  getsText: string;
  /** Payment method, transaction ID. */
  meta: SendReceiptRow[];
  footnote: string;
  credit: string;
  /** Signature block under the details, right-aligned. */
  signatory: { title: string; org: string };
};

type RGB = [number, number, number];

function hex(value: string | undefined, fallback: RGB): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(value?.trim() ?? "");
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** rgba() token flattened onto the white paper, so hairlines print the same. */
function rgbaOnWhite(value: string | undefined, fallback: RGB): RGB {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value?.trim() ?? "");
  if (!m) return fallback;
  const a = Number(m[4]);
  return [1, 2, 3].map((i) => Math.round(255 - a * (255 - Number(m[i])))) as RGB;
}

const C = {
  ink: hex(THEME_LIGHT["--ink"], [19, 17, 38]),
  muted: hex(THEME_LIGHT["--muted"], [76, 74, 102]),
  link: hex(THEME_LIGHT["--indigo-text"], [59, 46, 211]),
  warning: hex(THEME_LIGHT["--amber-text"], [138, 91, 0]),
  bg: hex(THEME_LIGHT["--bg"], [246, 244, 239]),
  border: rgbaOnWhite(THEME_LIGHT["--border"], [236, 236, 238]),
  brand: hex(THEME_LIGHT["--indigo"], [59, 46, 211]),
};

const px = (v: string) => parseFloat(v);
const em = (v: string) => parseFloat(v);
const SIZE = {
  caption: px(FONT_SIZE.caption),
  dense: px(FONT_SIZE.dense),
  body: px(FONT_SIZE.body),
  bodyLg: px(FONT_SIZE["body-lg"]),
  title: px(FONT_SIZE.title),
  headline: px(FONT_SIZE.headline),
};

/* ---------- Fonts ---------------------------------------------------------- */

type Face = "display" | "displaySemi" | "body" | "bodyMedium" | "bodyBold" | "mono" | "monoMedium";

const FONT_FILES: Record<Face, string> = {
  display: "SpaceGrotesk-Bold.ttf",
  displaySemi: "SpaceGrotesk-SemiBold.ttf",
  body: "DMSans-Regular.ttf",
  bodyMedium: "DMSans-Medium.ttf",
  bodyBold: "DMSans-Bold.ttf",
  mono: "DMMono-Regular.ttf",
  monoMedium: "DMMono-Medium.ttf",
};

/** "DMSans-Regular" — the PostScript-style name the PDF lists. */
const fontName = (face: Face) => FONT_FILES[face].replace(/\.ttf$/, "");

/** Built-in stand-ins if the brand fonts can't be fetched. */
const FALLBACK: Record<Face, [string, string]> = {
  display: ["helvetica", "bold"],
  displaySemi: ["helvetica", "bold"],
  body: ["helvetica", "normal"],
  bodyMedium: ["helvetica", "normal"],
  bodyBold: ["helvetica", "bold"],
  mono: ["courier", "normal"],
  monoMedium: ["courier", "bold"],
};

/** Distance from the top of a text line's content box to its baseline, per em
 * (the fonts' hhea ascent — how the browser places the glyphs). */
const ASCENT: Record<Face, number> = {
  display: 0.984,
  displaySemi: 0.984,
  body: 0.992,
  bodyMedium: 0.992,
  bodyBold: 0.992,
  mono: 0.98,
  monoMedium: 0.98,
};
/** CSS `line-height: normal` for these fonts (ascent + descent). */
const NORMAL_LH = 1.302;

let fontCache: Promise<Partial<Record<Face, string>>> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Loads the brand TTFs from /public/fonts/receipt once per session. */
function loadFonts(): Promise<Partial<Record<Face, string>>> {
  fontCache ??= Promise.all(
    (Object.keys(FONT_FILES) as Face[]).map(async (face) => {
      try {
        const res = await fetch(`/fonts/receipt/${FONT_FILES[face]}`);
        if (!res.ok) return [face, null] as const;
        return [face, toBase64(await res.arrayBuffer())] as const;
      } catch {
        return [face, null] as const;
      }
    }),
  ).then((entries) => {
    const out: Partial<Record<Face, string>> = {};
    for (const [face, data] of entries) if (data) out[face] = data;
    // Don't cache a total failure — let the next download try again.
    if (Object.keys(out).length === 0) fontCache = null;
    return out;
  });
  return fontCache;
}

/* ---------- Mark ----------------------------------------------------------- */

/** `public/brand/mboka-mark.svg` (viewBox 0 0 44 44); the 45%-opacity back
 * quad is pre-blended so it needs no PDF transparency. */
const MARK_BACK: RGB = [147, 140, 231];
function drawMark(doc: jsPDF, x: number, y: number, size: number) {
  const s = size / 44;
  doc.setFillColor(...C.brand);
  doc.roundedRect(x, y, size, size, 11 * s, 11 * s, "F");
  doc.setFillColor(...MARK_BACK);
  doc.lines([[11, 0], [0, 17], [-17, 0], [0, -11]], x + 24 * s, y + 18 * s, [s, s], "F", true);
  doc.setFillColor(255, 255, 255);
  doc.lines([[17, 0], [0, 11], [-6, 6], [-11, 0]], x + 9 * s, y + 9 * s, [s, s], "F", true);
}

/* ---------- Builder -------------------------------------------------------- */

export async function buildSendReceiptPdf(
  receipt: SendReceiptDoc,
  filenameStem: string,
): Promise<{ blob: Blob; filename: string }> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const W = 498;
  const X = (pageW - W) / 2;
  const R = X + W;
  const TOP = 48;

  for (const face of Object.keys(fonts) as Face[]) {
    const file = FONT_FILES[face];
    doc.addFileToVFS(file, fonts[face]!);
    doc.addFont(file, fontName(face), "normal");
  }

  let face: Face = "body";
  let size = SIZE.body;
  let tracking = 0;
  const style = (f: Face, s: number, color: RGB, trackEm = 0) => {
    face = f;
    size = s;
    tracking = trackEm * s;
    if (fonts[f]) doc.setFont(fontName(f), "normal");
    else doc.setFont(...FALLBACK[f]);
    doc.setFontSize(s);
    doc.setTextColor(...color);
  };
  const width = (t: string) => doc.getTextWidth(t) + tracking * t.length;
  /** Draws text whose content box starts at `top`. */
  const put = (t: string, x: number, top: number, align: "left" | "right" = "left") => {
    const left = align === "right" ? x - width(t) : x;
    doc.text(t, left, top + ASCENT[face] * size, tracking ? { charSpace: tracking } : undefined);
  };
  const wrap = (t: string, max: number): string[] => {
    const lines = doc.splitTextToSize(t, max) as string[];
    return lines.length ? lines : [""];
  };
  const hline = (y: number, h: number, color: RGB) => {
    doc.setFillColor(...color);
    doc.rect(X, y, W, h, "F");
  };
  const ensure = (y: number, need: number): number => {
    if (y + need <= pageH - TOP) return y;
    doc.addPage();
    return TOP;
  };
  const lh = (s: number) => s * NORMAL_LH;

  let y = TOP;

  /* Header — logo left, title and facts right, 2px ink rule under. */
  const markSize = 28;
  drawMark(doc, X, y, markSize);
  const wordSize = markSize * 0.45;
  style("displaySemi", wordSize, C.ink, 0.04);
  const word = "MBOKA";
  const wordX = X + markSize + markSize * 0.31;
  put(word, wordX, y + (markSize - lh(wordSize)) / 2);
  const colX = wordX + width(word) + 20;

  style("display", SIZE.headline, C.ink, em(LETTER_SPACING.title));
  put("Payment receipt", R, y, "right");
  let hy = y + lh(SIZE.headline) + 8;
  const facts: [string, string, Face, RGB][] = [
    ...(receipt.orderId ? [["Receipt no.", receipt.orderId, "mono", C.ink] as [string, string, Face, RGB]] : []),
    ...(receipt.paidAt ? [["Date", receipt.paidAt, "mono", C.ink] as [string, string, Face, RGB]] : []),
    ["Status", receipt.statusText, "monoMedium", receipt.pending ? C.warning : C.link],
  ];
  for (const [label, value, valueFace, color] of facts) {
    hy += 2;
    style("body", SIZE.body, C.muted);
    put(label, colX, hy);
    style(valueFace, SIZE.body, color);
    put(value, R, hy, "right");
    hy += lh(SIZE.body) + 2;
  }
  y = Math.max(hy, y + markSize) + 20;
  hline(y, 2, C.ink);
  y += 2;

  /* From / To */
  const label = (t: string, x: number, top: number, align: "left" | "right" = "left") => {
    style("display", SIZE.dense, C.muted, em(LETTER_SPACING.overline));
    put(t.toUpperCase(), x, top, align);
  };
  const half = (W - 24) / 2;
  const toX = X + half + 24;
  const block = (x: number, top: number, title: string, heading: string, lines: string[]) => {
    label(title, x, top);
    let ty = top + lh(SIZE.dense) + 6;
    style("bodyBold", SIZE.title, C.ink);
    for (const l of wrap(heading, half)) {
      put(l, x, ty);
      ty += lh(SIZE.title);
    }
    style("body", SIZE.bodyLg, C.muted);
    const lineH = SIZE.bodyLg * 1.55;
    for (const line of lines) {
      for (const l of wrap(line, half)) {
        put(l, x, ty + (lineH - lh(SIZE.bodyLg)) / 2);
        ty += lineH;
      }
    }
    return ty;
  };
  const fromEnd = block(X, y + 20, "From", receipt.sourceLabel, []);
  const toEnd = block(toX, y + 20, "To", receipt.recipientName || "Recipient", receipt.toLines);
  y = Math.max(fromEnd, toEnd) + 20;
  hline(y, 1, C.border);
  y += 1;

  /* Description / Amount */
  y += 14 + 6;
  label("Description", X, y);
  label("Amount", R, y, "right");
  y += lh(SIZE.dense) + 8;
  hline(y, 1, C.border);
  y += 1;

  const row = (r: SendReceiptRow, s: number, labelFace: Face, valueFace: Face, labelColor: RGB, pad: number) => {
    style(labelFace, s, labelColor);
    const labelW = width(r.label);
    style(valueFace, s, C.ink);
    const lines = wrap(r.value, W - labelW - 20);
    const h = lines.length * lh(s);
    y = ensure(y, h + pad * 2 + 1);
    style(labelFace, s, labelColor);
    put(r.label, X, y + pad);
    style(valueFace, s, C.ink);
    lines.forEach((l, i) => put(l, R, y + pad + i * lh(s), "right"));
    y += pad * 2 + h;
    hline(y, 1, C.border);
    y += 1;
  };
  for (const r of receipt.rows) row(r, SIZE.bodyLg, "body", "mono", C.muted, 10);
  row({ label: "Total debited", value: receipt.totalText }, SIZE.title, "bodyBold", "monoMedium", C.ink, 12);

  /* Amount received — tinted band, label and amount on one baseline. */
  y += 12;
  const bandH = 14 * 2 + lh(SIZE.headline);
  y = ensure(y, bandH);
  doc.setFillColor(...C.bg);
  doc.rect(X, y, W, bandH, "F");
  const baseline = y + 14 + ASCENT.monoMedium * SIZE.headline;
  style("monoMedium", SIZE.headline, C.ink);
  doc.text(receipt.getsText, R - 16 - width(receipt.getsText), baseline);
  style("bodyBold", SIZE.title, C.ink);
  doc.text(receipt.getsLabel, X + 16, baseline);
  y += bandH;

  /* Payment method + transaction ID (9.5rem label column) on the left, the
   * signatory on the right, bottom-aligned — one band, like the screen. */
  const sigW = 208;
  const sigX = R - sigW;
  const metaW = W - sigW - 24;
  const metaRows = receipt.meta.map((m) => {
    style(m.mono ? "mono" : "body", SIZE.bodyLg, C.ink);
    return { ...m, lines: wrap(m.value, metaW - 152 - 16) };
  });
  const metaH = metaRows.reduce((h, m) => h + 8 + m.lines.length * lh(SIZE.bodyLg), 0);
  const sigMark = 20;
  const sigH = sigMark + 8 + 1 + 6 + lh(SIZE.bodyLg) + lh(SIZE.caption);
  const bandH2 = Math.max(metaH, sigH);
  y = ensure(y, bandH2 + 29);
  y += 14;

  let my = y + bandH2 - metaH;
  for (const m of metaRows) {
    style("body", SIZE.bodyLg, C.muted);
    put(m.label, X, my + 4);
    style(m.mono ? "mono" : "body", SIZE.bodyLg, C.ink);
    m.lines.forEach((l, i) => put(l, X + 152 + 16, my + 4 + i * lh(SIZE.bodyLg)));
    my += 8 + m.lines.length * lh(SIZE.bodyLg);
  }

  let sy = y + bandH2 - sigH;
  drawMark(doc, sigX, sy, sigMark);
  const sigWord = sigMark * 0.45;
  style("displaySemi", sigWord, C.ink, 0.04);
  put(word, sigX + sigMark + sigMark * 0.31, sy + (sigMark - lh(sigWord)) / 2);
  sy += sigMark + 8;
  doc.setFillColor(...C.ink);
  doc.rect(sigX, sy, sigW, 1, "F");
  sy += 1 + 6;
  style("bodyBold", SIZE.bodyLg, C.ink);
  put(receipt.signatory.title, sigX, sy);
  sy += lh(SIZE.bodyLg);
  style("body", SIZE.caption, C.muted);
  put(receipt.signatory.org, sigX, sy);

  y += bandH2 + 14;
  hline(y, 1, C.border);
  y += 1;

  /* Footer */
  y += 16;
  style("body", SIZE.caption, C.muted);
  const capH = SIZE.caption * 1.6;
  const para = (t: string) => {
    for (const l of wrap(t, W)) {
      y = ensure(y, capH);
      put(l, X, y + (capH - lh(SIZE.caption)) / 2);
      y += capH;
    }
  };
  para(receipt.footnote);
  y += 6;
  para(receipt.credit);

  const stem = filenameStem.replace(/\.pdf$/i, "").trim() || "mboka-receipt";
  return { blob: doc.output("blob"), filename: `${stem}.pdf` };
}
