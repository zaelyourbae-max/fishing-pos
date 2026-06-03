import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { promises as fsp } from "fs";
import path from "path";

// ── Page geometry (A4 portrait) ─────────────────────────────────────────────
export const PW = 595;
export const PH = 842;
export const MX = 40;
export const CW = PW - MX * 2; // 515
export const RIGHT = MX + CW;  // 555

// ── Colors ──────────────────────────────────────────────────────────────────
export const C_NAVY    = rgb(0.059, 0.090, 0.165);
export const C_SLATE   = rgb(0.200, 0.255, 0.333);
export const C_MUTED   = rgb(0.580, 0.635, 0.722);
export const C_BORDER  = rgb(0.886, 0.910, 0.941);
export const C_TEAL    = rgb(0.051, 0.580, 0.533);
export const C_TEAL_BG = rgb(0.941, 0.992, 0.980);
export const C_STRIPE  = rgb(0.973, 0.980, 0.988);
export const C_HDR_BG  = rgb(0.945, 0.961, 0.976);
export const C_BLUE    = rgb(0.231, 0.510, 0.965);
export const C_AMBER   = rgb(0.851, 0.467, 0.024);
export const C_ROSE    = rgb(0.882, 0.114, 0.282);
export const C_WHITE   = rgb(1, 1, 1);
export const C_BYLINE  = rgb(0.576, 0.588, 0.624);

export type C = ReturnType<typeof rgb>;

// ── Fonts ─────────────────────────────────────────────────────────────────────
export type Fonts = { r400: PDFFont; r600: PDFFont; r700: PDFFont; r800: PDFFont };

export async function loadInterFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit as never);
  const dir = path.join(process.cwd(), "assets/fonts");
  const [b400, b600, b700, b800] = await Promise.all([
    fsp.readFile(path.join(dir, "Inter-Regular.ttf")),
    fsp.readFile(path.join(dir, "Inter-SemiBold.ttf")),
    fsp.readFile(path.join(dir, "Inter-Bold.ttf")),
    fsp.readFile(path.join(dir, "Inter-ExtraBold.ttf")),
  ]);
  const [r400, r600, r700, r800] = await Promise.all([
    doc.embedFont(b400, { subset: true }),
    doc.embedFont(b600, { subset: true }),
    doc.embedFont(b700, { subset: true }),
    doc.embedFont(b800, { subset: true }),
  ]);
  return { r400, r600, r700, r800 };
}

// ── Primitives (topY = distance from top of page) ───────────────────────────────
export function baselineY(topY: number, font: PDFFont, size: number) {
  return PH - topY - font.heightAtSize(size, { descender: false });
}
export function dt(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C) {
  p.drawText(t, { x, y: baselineY(topY, font, size), font, size, color });
}
export function dtR(p: PDFPage, t: string, rx: number, topY: number, font: PDFFont, size: number, color: C) {
  dt(p, t, rx - font.widthOfTextAtSize(t, size), topY, font, size, color);
}
export function dtSpaced(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C, sp: number) {
  let cx = x;
  for (const ch of t) { dt(p, ch, cx, topY, font, size, color); cx += font.widthOfTextAtSize(ch, size) + sp; }
}
export function spacedWidth(t: string, font: PDFFont, size: number, sp: number) {
  let w = -sp;
  for (const ch of t) w += font.widthOfTextAtSize(ch, size) + sp;
  return w;
}
export function dr(p: PDFPage, x: number, topY: number, w: number, h: number, color: C, bc?: C, bw = 0.5) {
  p.drawRectangle({ x, y: PH - topY - h, width: w, height: h, color, ...(bc ? { borderColor: bc, borderWidth: bw } : {}) });
}
export function rounded(p: PDFPage, x: number, topY: number, w: number, h: number, r: number, color: C, bc?: C) {
  const k = 0.5523, kr = r * k;
  const pth = [
    `M ${r} 0`, `L ${w - r} 0`, `C ${w - kr} 0 ${w} ${kr} ${w} ${r}`,
    `L ${w} ${h - r}`, `C ${w} ${h - kr} ${w - kr} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`, `C ${kr} ${h} 0 ${h - kr} 0 ${h - r}`,
    `L 0 ${r}`, `C 0 ${kr} ${kr} 0 ${r} 0`, "Z",
  ].join(" ");
  p.drawSvgPath(pth, { x, y: PH - topY, color, ...(bc ? { borderColor: bc, borderWidth: 0.5 } : {}) });
}
export function hl(p: PDFPage, x1: number, topY: number, x2: number, color: C, w = 0.5) {
  p.drawLine({ start: { x: x1, y: PH - topY }, end: { x: x2, y: PH - topY }, thickness: w, color });
}
export function rowText(p: PDFPage, t: string, x: number, rowTopY: number, rowH: number, font: PDFFont, size: number, color: C, right = false) {
  const topY = rowTopY + (rowH - font.heightAtSize(size, { descender: false })) / 2 - 0.5;
  if (right) dtR(p, t, x, topY, font, size, color); else dt(p, t, x, topY, font, size, color);
}
export function cutW(t: string, font: PDFFont, size: number, maxW: number) {
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}..`, size) > maxW) s = s.slice(0, -1);
  return `${s}..`;
}
export function fitSize(t: string, font: PDFFont, maxSize: number, minSize: number, maxW: number) {
  let s = maxSize;
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxW) s -= 0.5;
  return s;
}
