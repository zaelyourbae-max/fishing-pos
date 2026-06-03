import { requireOwner } from "@/lib/auth-session";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import {
  getOwnerReportSummary,
  getOwnerReportTransactions,
  type OwnerReportRange,
  reportDateStamp,
  rupiah,
} from "@/lib/reports";
import { NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { promises as fsp } from "fs";
import path from "path";

export const runtime = "nodejs";

// ── Layout ────────────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const MX = 40;
const CW = PW - MX * 2;        // 515
const RIGHT = MX + CW;         // 555
const CONTENT_TOP = 104;
const CONTENT_BOTTOM = 786;

// ── Colors ────────────────────────────────────────────────────────────────────
const C_NAVY    = rgb(0.059, 0.090, 0.165);
const C_SLATE   = rgb(0.200, 0.255, 0.333);
const C_MUTED   = rgb(0.580, 0.635, 0.722);
const C_BORDER  = rgb(0.886, 0.910, 0.941);
const C_TEAL    = rgb(0.051, 0.580, 0.533);
const C_TEAL_BG = rgb(0.941, 0.992, 0.980);
const C_STRIPE  = rgb(0.973, 0.980, 0.988);
const C_HDR_BG  = rgb(0.945, 0.961, 0.976);
const C_BLUE    = rgb(0.231, 0.510, 0.965);
const C_AMBER   = rgb(0.851, 0.467, 0.024);
const C_ROSE    = rgb(0.882, 0.114, 0.282);
const C_WHITE   = rgb(1, 1, 1);
const C_BYLINE  = rgb(0.576, 0.588, 0.624);

type C = ReturnType<typeof rgb>;

// ── Fonts ─────────────────────────────────────────────────────────────────────
type Fonts = { r400: PDFFont; r600: PDFFont; r700: PDFFont; r800: PDFFont };

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
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

// ── Draw primitives ─────────────────────────────────────────────────────────────
function baselineY(topY: number, font: PDFFont, size: number) {
  return PH - topY - font.heightAtSize(size, { descender: false });
}
function dt(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C) {
  p.drawText(t, { x, y: baselineY(topY, font, size), font, size, color });
}
function dtR(p: PDFPage, t: string, rx: number, topY: number, font: PDFFont, size: number, color: C) {
  dt(p, t, rx - font.widthOfTextAtSize(t, size), topY, font, size, color);
}
function dtSpaced(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C, sp: number) {
  let cx = x;
  for (const ch of t) { dt(p, ch, cx, topY, font, size, color); cx += font.widthOfTextAtSize(ch, size) + sp; }
}
function dr(p: PDFPage, x: number, topY: number, w: number, h: number, color: C, bc?: C, bw = 0.5) {
  p.drawRectangle({ x, y: PH - topY - h, width: w, height: h, color, ...(bc ? { borderColor: bc, borderWidth: bw } : {}) });
}
function rounded(p: PDFPage, x: number, topY: number, w: number, h: number, r: number, color: C, bc?: C) {
  const k = 0.5523, kr = r * k;
  // local coords (0,0 = top-left, y grows downward), origin placed at (x, PH-topY)
  const pth = [
    `M ${r} 0`, `L ${w - r} 0`, `C ${w - kr} 0 ${w} ${kr} ${w} ${r}`,
    `L ${w} ${h - r}`, `C ${w} ${h - kr} ${w - kr} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`, `C ${kr} ${h} 0 ${h - kr} 0 ${h - r}`,
    `L 0 ${r}`, `C 0 ${kr} ${kr} 0 ${r} 0`, "Z",
  ].join(" ");
  p.drawSvgPath(pth, { x, y: PH - topY, color, ...(bc ? { borderColor: bc, borderWidth: 0.5 } : {}) });
}
function hl(p: PDFPage, x1: number, topY: number, x2: number, color: C, w = 0.5) {
  p.drawLine({ start: { x: x1, y: PH - topY }, end: { x: x2, y: PH - topY }, thickness: w, color });
}
function rowText(p: PDFPage, t: string, x: number, rowTopY: number, rowH: number, font: PDFFont, size: number, color: C, right = false) {
  const topY = rowTopY + (rowH - font.heightAtSize(size, { descender: false })) / 2 - 0.5;
  if (right) dtR(p, t, x, topY, font, size, color); else dt(p, t, x, topY, font, size, color);
}
function cutW(t: string, font: PDFFont, size: number, maxW: number) {
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}..`, size) > maxW) s = s.slice(0, -1);
  return `${s}..`;
}
function fitSize(t: string, font: PDFFont, maxSize: number, minSize: number, maxW: number) {
  let s = maxSize;
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxW) s -= 0.5;
  return s;
}

// ── Components ──────────────────────────────────────────────────────────────────
function drawHeader(p: PDFPage, f: Fonts, storeName: string, periodLabel: string, printedAt: string) {
  // teal accent bar
  rounded(p, MX, 26, 4, 58, 2, C_TEAL);

  // Left: brand identity (matches invoice)
  dt(p, storeName, MX + 14, 30, f.r800, 19, C_NAVY);
  dt(p, "by Meijrverse\xb0", MX + 14, 58, f.r400, 9, C_BYLINE);

  // Right: document title "LAPORAN OWNER" with letter-spacing (like INVOICE)
  const title = "LAPORAN OWNER";
  const tSp = 1.5, tSz = 15;
  let tW = -tSp;
  for (const ch of title) tW += f.r800.widthOfTextAtSize(ch, tSz) + tSp;
  dtSpaced(p, title, RIGHT - tW, 30, f.r800, tSz, C_TEAL, tSp);

  // Right: period + printed (right-aligned label · value)
  const meta = (label: string, value: string, topY: number) => {
    const vW = f.r700.widthOfTextAtSize(value, 8.5);
    dtR(p, value, RIGHT, topY, f.r700, 8.5, C_NAVY);
    const lW = f.r400.widthOfTextAtSize(label, 8);
    dt(p, label, RIGHT - vW - 6 - lW, topY + 0.5, f.r400, 8, C_MUTED);
  };
  meta("Periode", periodLabel, 54);
  meta("Dicetak", printedAt, 68);

  hl(p, MX, 90, RIGHT, C_TEAL, 1.5);
}

function drawFooter(p: PDFPage, f: Fonts, storeName: string, num: number, total: number) {
  hl(p, MX, 802, RIGHT, C_BORDER, 0.5);
  dt(p, storeName, MX, 812, f.r700, 7, C_MUTED);
  const mid = "by MeijrVerse\xb0";
  dt(p, mid, (PW - f.r400.widthOfTextAtSize(mid, 7)) / 2, 812, f.r400, 7, C_MUTED);
  dtR(p, `Halaman ${num} dari ${total}`, RIGHT, 812, f.r400, 7, C_MUTED);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const { range, periodLabel, filenameDate } = resolveExportDate(url.searchParams);

  const [report, transactions] = await Promise.all([
    getOwnerReportSummary(range),
    getOwnerReportTransactions(60, range),
  ]);

  const paymentRows = report.month.paymentSummary.map((item) => ({
    method: item.paymentLabel,
    transactions: item.transactions,
    total: item.total,
  }));
  const paymentTotal = paymentRows.reduce((s, r) => s + r.total, 0);

  const storeName = report.settings.storeName;
  const printedAt = formatDateTimeID(new Date());

  // ── PDF setup ─────────────────────────────────────────────────────────────────
  const doc = await PDFDocument.create();
  const f = await loadFonts(doc);
  const pages: PDFPage[] = [];

  function startPage(): PDFPage {
    const p = doc.addPage([PW, PH]);
    pages.push(p);
    drawHeader(p, f, storeName, periodLabel, printedAt);
    return p;
  }

  let page = startPage();
  let y = CONTENT_TOP;

  // ── Section title ───────────────────────────────────────────────────────────
  function sectionTitle(label: string) {
    rounded(page, MX, y, CW, 24, 5, C_HDR_BG);
    rounded(page, MX, y, 3, 24, 1.5, C_TEAL);
    dt(page, label.toUpperCase(), MX + 14, y + 7, f.r700, 8.5, C_NAVY);
    y += 24 + 10;
  }

  // ── Metric cards (3 per row) ──────────────────────────────────────────────────
  const CARD_W = 165;
  const CARD_GAP = (CW - CARD_W * 3) / 2;  // 10
  const CARD_H = 72;
  function metricRow(cards: { label: string; value: string; helper: string; accent: C }[]) {
    cards.forEach((c, i) => {
      const x = MX + i * (CARD_W + CARD_GAP);
      rounded(page, x, y, CARD_W, CARD_H, 7, C_WHITE, C_BORDER);
      rounded(page, x, y + 6, 4, CARD_H - 12, 2, c.accent);
      dt(page, c.label.toUpperCase(), x + 16, y + 14, f.r600, 7.5, C_MUTED);
      const vs = fitSize(c.value, f.r800, 14, 9, CARD_W - 28);
      dt(page, c.value, x + 16, y + 32, f.r800, vs, C_NAVY);
      dt(page, c.helper, x + 16, y + 54, f.r400, 7.5, C_MUTED);
    });
    y += CARD_H + 12;
  }

  // ── Generic table ───────────────────────────────────────────────────────────
  type Col = { label: string; x: number; right?: boolean; maxW?: number };
  const HROW = 26;
  const ROWH = 24;

  function tableHead(cols: Col[]) {
    rounded(page, MX, y, CW, HROW, 4, C_NAVY);
    for (const c of cols) rowText(page, c.label, c.x, y, HROW, f.r700, 7.5, C_WHITE, c.right);
    y += HROW;
  }

  function drawRowBg(fill: C) {
    dr(page, MX, y, CW, ROWH, fill, C_BORDER);
  }

  function table(cols: Col[], rows: string[][], contTitle: string, opts?: { totalRow?: string[] }) {
    tableHead(cols);
    rows.forEach((row, idx) => {
      if (y + ROWH > CONTENT_BOTTOM) {
        page = startPage(); y = CONTENT_TOP;
        sectionTitle(`${contTitle} (lanjutan)`);
        tableHead(cols);
      }
      drawRowBg(idx % 2 === 0 ? C_WHITE : C_STRIPE);
      cols.forEach((c, ci) => {
        const raw = row[ci] ?? "";
        const v = c.maxW ? cutW(raw, f.r400, 8, c.maxW) : raw;
        rowText(page, v, c.x, y, ROWH, f.r400, 8, C_SLATE, c.right);
      });
      y += ROWH;
    });
    if (opts?.totalRow) {
      if (y + ROWH > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; tableHead(cols); }
      dr(page, MX, y, CW, ROWH, C_TEAL_BG, C_BORDER);
      cols.forEach((c, ci) => {
        const v = opts.totalRow![ci] ?? "";
        if (v) rowText(page, c.maxW ? cutW(v, f.r700, 8, c.maxW) : v, c.x, y, ROWH, f.r700, 8, C_TEAL, c.right);
      });
      y += ROWH;
    }
  }

  function emptyRow(message: string) {
    drawRowBg(C_WHITE);
    rowText(page, message, MX + 14, y, ROWH, f.r400, 8, C_MUTED);
    y += ROWH;
  }

  // ── RINGKASAN ─────────────────────────────────────────────────────────────────
  sectionTitle("Ringkasan");
  metricRow([
    { label: "Omzet Kotor",     value: rupiah(report.month.grossOmzet), helper: "Sebelum retur",       accent: C_TEAL },
    { label: "Omzet Bersih",    value: rupiah(report.month.netOmzet),   helper: "Setelah retur",       accent: C_TEAL },
    { label: "Total Transaksi", value: String(report.month.transactions), helper: "Transaksi periode", accent: C_BLUE },
  ]);
  metricRow([
    { label: "ATV",             value: rupiah(report.month.averageTransaction),         helper: "Rata-rata transaksi", accent: C_BLUE },
    { label: "Total Pembelian", value: rupiah(report.inventoryReturns.totalPurchaseMonth), helper: "Pembelian periode", accent: C_AMBER },
    { label: "Retur Supplier",  value: rupiah(report.inventoryReturns.monthValue),      helper: "Inventory-side",      accent: C_AMBER },
  ]);
  y += 6;

  // ── RETUR ──────────────────────────────────────────────────────────────────────
  sectionTitle("Retur");
  metricRow([
    { label: "Jumlah Retur",     value: String(report.month.returnCount),          helper: "Customer return", accent: C_ROSE },
    { label: "Nilai Retur",      value: rupiah(report.month.returnValue),          helper: "Total refund",    accent: C_ROSE },
    { label: "Alasan Terbanyak", value: report.returns.topReason?.label ?? "-",    helper: "Reason summary",  accent: C_AMBER },
  ]);
  y += 6;

  // ── PAYMENT SUMMARY ─────────────────────────────────────────────────────────────
  sectionTitle("Payment Summary");
  const payCols: Col[] = [
    { label: "Metode Pembayaran", x: MX + 14, maxW: 280 },
    { label: "Transaksi",         x: 410, right: true, maxW: 70 },
    { label: "Total Omzet",       x: RIGHT - 8, right: true, maxW: 130 },
  ];
  if (paymentRows.length === 0) {
    tableHead(payCols);
    emptyRow("Belum ada transaksi");
  } else {
    table(payCols,
      paymentRows.map((r) => [r.method, String(r.transactions), rupiah(r.total)]),
      "Payment Summary",
      { totalRow: ["Total", `${paymentRows.length} Metode`, rupiah(paymentTotal)] },
    );
  }
  y += 14;

  // ── TOP PRODUK ───────────────────────────────────────────────────────────────
  if (y + 90 > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; }
  sectionTitle("Top Produk");
  const prodCols: Col[] = [
    { label: "Produk",  x: MX + 14, maxW: 210 },
    { label: "SKU",     x: 286,     maxW: 120 },
    { label: "Qty",     x: 430, right: true, maxW: 50 },
    { label: "Omzet",   x: RIGHT - 8, right: true, maxW: 120 },
  ];
  if (report.bestSellers.length === 0) {
    tableHead(prodCols);
    emptyRow("Belum ada produk terjual");
  } else {
    table(prodCols,
      report.bestSellers.map((p) => [p.name, p.sku ?? "-", String(p.qty), rupiah(p.total)]),
      "Top Produk",
    );
  }

  // ── TRANSAKSI TERAKHIR (new page) ──────────────────────────────────────────────
  page = startPage();
  y = CONTENT_TOP;
  sectionTitle("Transaksi Terakhir");
  const txCols: Col[] = [
    { label: "Invoice",  x: MX + 14, maxW: 96 },
    { label: "Tanggal",  x: 150,     maxW: 96 },
    { label: "Customer", x: 252,     maxW: 84 },
    { label: "Operator", x: 344,     maxW: 70 },
    { label: "Payment",  x: 420,     maxW: 64 },
    { label: "Total",    x: RIGHT - 8, right: true, maxW: 90 },
  ];
  if (transactions.length === 0) {
    tableHead(txCols);
    emptyRow("Belum ada transaksi periode ini");
  } else {
    table(txCols,
      transactions.map((sale) => [
        sale.invoiceNumber,
        formatDateTimeID(sale.createdAt),
        sale.customer?.name ?? "Walk-in",
        sale.cashier?.name?.trim() || "-",
        sale.paymentLabel,
        rupiah(sale.subtotal),
      ]),
      "Transaksi Terakhir",
    );
  }
  y += 14;

  // ── STOK RENDAH ────────────────────────────────────────────────────────────────
  if (report.lowStockProducts.length > 0) {
    if (y + 90 > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; }
    sectionTitle("Stok Rendah");
    const stockCols: Col[] = [
      { label: "Produk", x: MX + 14, maxW: 240 },
      { label: "SKU",    x: 300,     maxW: 170 },
      { label: "Stok",   x: RIGHT - 8, right: true, maxW: 50 },
    ];
    table(stockCols,
      report.lowStockProducts.map((p) => [p.name, p.sku ?? "-", String(p.stock)]),
      "Stok Rendah",
    );
  }

  // ── Footers ──────────────────────────────────────────────────────────────────
  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, f, storeName, i + 1, total));

  const pdfBytes = await doc.save();
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="owner-report-${filenameDate}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBusinessDate(value: string | null, end = false) {
  if (!value || !BUSINESS_DATE_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  let date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  // Clamp future dates to today (safety net)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date > today) date = today;
  if (end) date.setHours(23, 59, 59, 999);
  return date;
}

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function endOfDay(date: Date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

function filenameDateRange(from?: Date, to?: Date) {
  if (!from && !to) return reportDateStamp();
  const fromKey = from ? reportDateStamp(from) : reportDateStamp(to);
  const toKey = to ? reportDateStamp(to) : fromKey;
  return fromKey === toKey ? fromKey : `${fromKey}-to-${toKey}`;
}

function resolvePresetRange(preset: string | null) {
  const today = startOfDay(new Date());
  if (preset === "today")                            return { from: today, to: endOfDay(today) } satisfies OwnerReportRange;
  if (preset === "7d")                               return { from: addDays(today, -6), to: endOfDay(today) } satisfies OwnerReportRange;
  if (preset === "30d")                              return { from: addDays(today, -29), to: endOfDay(today) } satisfies OwnerReportRange;
  if (preset === "this-month" || preset === "month") return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfDay(today) } satisfies OwnerReportRange;
  if (preset === "last-month" || preset === "yesterday") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from, to: endOfDay(to) } satisfies OwnerReportRange;
  }
  if (preset === "this-year") return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) } satisfies OwnerReportRange;
  if (preset === "last-year") return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear() - 1, 11, 31) } satisfies OwnerReportRange;
  return null;
}

function fmtDate(date?: Date) { return date ? formatDateID(date) : "-"; }

function resolveExportDate(searchParams: URLSearchParams) {
  const selectedDate = searchParams.get("date");
  if (selectedDate && BUSINESS_DATE_PATTERN.test(selectedDate)) {
    const from = parseBusinessDate(selectedDate);
    const to = parseBusinessDate(selectedDate, true);
    if (from && to) return { range: { from, to } satisfies OwnerReportRange, periodLabel: fmtDate(from), filenameDate: selectedDate };
  }
  const fromKey = searchParams.get("from");
  const toKey = searchParams.get("to");
  const from = parseBusinessDate(fromKey);
  const to = parseBusinessDate(toKey, true);
  const range: OwnerReportRange = { from, to };
  const periodLabel = from || to ? `${fmtDate(from)} - ${fmtDate(to)}` : "Bulan ini";
  if (from || to) return { range, periodLabel, filenameDate: filenameDateRange(from, to) };
  const presetRange = resolvePresetRange(searchParams.get("preset"));
  if (presetRange) return { range: presetRange, periodLabel: `${fmtDate(presetRange.from)} - ${fmtDate(presetRange.to)}`, filenameDate: filenameDateRange(presetRange.from, presetRange.to) };
  return { range, periodLabel, filenameDate: reportDateStamp() };
}
