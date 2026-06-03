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
import { PDFDocument, PDFPage } from "pdf-lib";
import {
  C_AMBER, C_BLUE, C_BORDER, C_BYLINE, C_HDR_BG, C_MUTED, C_NAVY,
  C_ROSE, C_SLATE, C_STRIPE, C_TEAL, C_TEAL_BG, C_WHITE,
  CW, Fonts, MX, PH, PW, RIGHT, type C,
  cutW, dr, dt, dtR, dtSpaced, fitSize, hl, loadInterFonts, rounded, rowText, spacedWidth,
} from "@/lib/pdf/report-kit";

export const runtime = "nodejs";

const CONTENT_TOP = 104;
const CONTENT_BOTTOM = 786;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ── Header / footer ──────────────────────────────────────────────────────────
function drawHeader(p: PDFPage, f: Fonts, storeName: string, dateLabel: string, printedAt: string) {
  rounded(p, MX, 26, 4, 58, 2, C_TEAL);
  dt(p, storeName, MX + 14, 30, f.r800, 19, C_NAVY);
  dt(p, "by Meijrverse\xb0", MX + 14, 58, f.r400, 9, C_BYLINE);

  const title = "RINGKASAN HARIAN";
  const tSp = 1.4, tSz = 14;
  dtSpaced(p, title, RIGHT - spacedWidth(title, f.r800, tSz, tSp), 30, f.r800, tSz, C_TEAL, tSp);

  const meta = (label: string, value: string, topY: number) => {
    const vW = f.r700.widthOfTextAtSize(value, 8.5);
    dtR(p, value, RIGHT, topY, f.r700, 8.5, C_NAVY);
    const lW = f.r400.widthOfTextAtSize(label, 8);
    dt(p, label, RIGHT - vW - 6 - lW, topY + 0.5, f.r400, 8, C_MUTED);
  };
  meta("Tanggal", dateLabel, 54);
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

// ── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  // Resolve target day (default: today), clamp future to today
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let day = new Date(today);
  if (dateParam && BUSINESS_DATE_PATTERN.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime()) && parsed <= today) day = parsed;
  }
  const from = new Date(day); from.setHours(0, 0, 0, 0);
  const to = new Date(day); to.setHours(23, 59, 59, 999);
  const range: OwnerReportRange = { from, to };

  const [report, transactions] = await Promise.all([
    getOwnerReportSummary(range),
    getOwnerReportTransactions(60, range),
  ]);

  const d = report.month; // single-day figures
  const storeName = report.settings.storeName;
  const printedAt = formatDateTimeID(new Date());
  const dateLabel = formatDateID(from);
  const filenameDate = reportDateStamp(from);

  const paymentRows = d.paymentSummary.map((item) => ({
    method: item.paymentLabel,
    transactions: item.transactions,
    total: item.total,
  }));
  const paymentTotal = paymentRows.reduce((s, r) => s + r.total, 0);

  const doc = await PDFDocument.create();
  const f = await loadInterFonts(doc);
  const pages: PDFPage[] = [];

  function startPage(): PDFPage {
    const p = doc.addPage([PW, PH]);
    pages.push(p);
    drawHeader(p, f, storeName, dateLabel, printedAt);
    return p;
  }

  let page = startPage();
  let y = CONTENT_TOP;

  function sectionTitle(label: string) {
    rounded(page, MX, y, CW, 24, 5, C_HDR_BG);
    rounded(page, MX, y, 3, 24, 1.5, C_TEAL);
    dt(page, label.toUpperCase(), MX + 14, y + 7, f.r700, 8.5, C_NAVY);
    y += 24 + 10;
  }

  const CARD_W = 165;
  const CARD_GAP = (CW - CARD_W * 3) / 2;
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

  type Col = { label: string; x: number; right?: boolean; maxW?: number };
  const HROW = 26, ROWH = 24;

  function tableHead(cols: Col[]) {
    rounded(page, MX, y, CW, HROW, 4, C_NAVY);
    for (const c of cols) rowText(page, c.label, c.x, y, HROW, f.r700, 7.5, C_WHITE, c.right);
    y += HROW;
  }
  function table(cols: Col[], rows: string[][], emptyMsg: string, totalRow?: string[]) {
    tableHead(cols);
    if (rows.length === 0) {
      dr(page, MX, y, CW, ROWH, C_WHITE, C_BORDER);
      rowText(page, emptyMsg, MX + 14, y, ROWH, f.r400, 8, C_MUTED);
      y += ROWH;
      return;
    }
    rows.forEach((row, idx) => {
      if (y + ROWH > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; tableHead(cols); }
      dr(page, MX, y, CW, ROWH, idx % 2 === 0 ? C_WHITE : C_STRIPE, C_BORDER);
      cols.forEach((c, ci) => {
        const raw = row[ci] ?? "";
        rowText(page, c.maxW ? cutW(raw, f.r400, 8, c.maxW) : raw, c.x, y, ROWH, f.r400, 8, C_SLATE, c.right);
      });
      y += ROWH;
    });
    if (totalRow) {
      dr(page, MX, y, CW, ROWH, C_TEAL_BG, C_BORDER);
      cols.forEach((c, ci) => {
        const v = totalRow[ci] ?? "";
        if (v) rowText(page, c.maxW ? cutW(v, f.r700, 8, c.maxW) : v, c.x, y, ROWH, f.r700, 8, C_TEAL, c.right);
      });
      y += ROWH;
    }
  }

  // ── RINGKASAN HARI INI ─────────────────────────────────────────────────────
  sectionTitle("Ringkasan Hari Ini");
  metricRow([
    { label: "Omzet Kotor",  value: rupiah(d.grossOmzet),         helper: "Sebelum retur",       accent: C_TEAL },
    { label: "Omzet Bersih", value: rupiah(d.netOmzet),           helper: "Setelah retur",       accent: C_TEAL },
    { label: "Transaksi",    value: String(d.transactions),       helper: "Jumlah transaksi",    accent: C_BLUE },
  ]);
  metricRow([
    { label: "ATV",          value: rupiah(d.averageTransaction), helper: "Rata-rata transaksi", accent: C_BLUE },
    { label: "Jumlah Retur", value: String(d.returnCount),        helper: "Customer return",     accent: C_ROSE },
    { label: "Nilai Retur",  value: rupiah(d.returnValue),        helper: "Total refund",        accent: C_ROSE },
  ]);
  y += 6;

  // ── PEMBAYARAN HARI INI ────────────────────────────────────────────────────
  sectionTitle("Pembayaran Hari Ini");
  table(
    [
      { label: "Metode Pembayaran", x: MX + 14, maxW: 280 },
      { label: "Transaksi",         x: 410, right: true, maxW: 70 },
      { label: "Total Omzet",       x: RIGHT - 8, right: true, maxW: 130 },
    ],
    paymentRows.map((r) => [r.method, String(r.transactions), rupiah(r.total)]),
    "Belum ada transaksi pada tanggal ini",
    paymentRows.length > 0 ? ["Total", `${paymentRows.length} Metode`, rupiah(paymentTotal)] : undefined,
  );
  y += 14;

  // ── PRODUK TERJUAL ─────────────────────────────────────────────────────────
  sectionTitle("Produk Terjual");
  table(
    [
      { label: "Produk", x: MX + 14, maxW: 230 },
      { label: "SKU",    x: 300,     maxW: 120 },
      { label: "Qty",    x: 430, right: true, maxW: 50 },
      { label: "Omzet",  x: RIGHT - 8, right: true, maxW: 120 },
    ],
    report.bestSellers.slice(0, 10).map((p) => [p.name, p.sku ?? "-", String(p.qty), rupiah(p.total)]),
    "Belum ada produk terjual",
  );
  y += 14;

  // ── STOK RENDAH ────────────────────────────────────────────────────────────
  if (report.lowStockProducts.length > 0) {
    if (y + 90 > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; }
    sectionTitle("Stok Rendah");
    table(
      [
        { label: "Produk", x: MX + 14, maxW: 240 },
        { label: "SKU",    x: 300,     maxW: 170 },
        { label: "Stok",   x: RIGHT - 8, right: true, maxW: 50 },
      ],
      report.lowStockProducts.map((p) => [p.name, p.sku ?? "-", String(p.stock)]),
      "Tidak ada stok rendah",
    );
  }

  void C_AMBER; void transactions; // reserved for future sections
  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, f, storeName, i + 1, total));

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ringkasan-harian-${filenameDate}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
