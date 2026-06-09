import { requireOwner } from "@/lib/auth-session";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { serializeProfitSummary } from "@/lib/report-profit-detail";
import { getOwnerReportSummary, type OwnerReportRange } from "@/lib/reports";
import { NextResponse } from "next/server";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import {
  C_AMBER, C_BLUE, C_BORDER, C_BYLINE, C_HDR_BG, C_MUTED, C_NAVY,
  C_ROSE, C_SLATE, C_STRIPE, C_TEAL, C_WHITE,
  CW, Fonts, MX, PH, PW, RIGHT, type C,
  cutW, dr, dt, dtR, dtSpaced, fitSize, hl, loadInterFonts, rounded, rowText, spacedWidth,
} from "@/lib/pdf/report-kit";

export const runtime = "nodejs";

const CONTENT_TOP = 104;
const CONTENT_BOTTOM = 786;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Light pill tints for status badges (mirror on-screen colored chips)
const C_TEAL_TINT  = rgb(0.902, 0.969, 0.953);
const C_AMBER_TINT = rgb(0.992, 0.953, 0.851);
const C_AMBER_FG   = rgb(0.490, 0.275, 0.016);
const C_ROSE_TINT  = rgb(0.992, 0.902, 0.929);
const C_SLATE_TINT = rgb(0.929, 0.949, 0.969);

function statusPill(status: string): { bg: C; fg: C } {
  switch (status) {
    case "Sehat":         return { bg: C_TEAL_TINT,  fg: C_TEAL };
    case "Margin rendah": return { bg: C_AMBER_TINT, fg: C_AMBER_FG };
    case "Rugi":          return { bg: C_ROSE_TINT,  fg: C_ROSE };
    default:              return { bg: C_SLATE_TINT, fg: C_SLATE }; // HPP belum lengkap / Cek HPP retur
  }
}

// ── Header / footer ──────────────────────────────────────────────────────────
function drawHeader(p: PDFPage, f: Fonts, storeName: string, periodLabel: string, printedAt: string) {
  rounded(p, MX, 26, 4, 58, 2, C_TEAL);
  dt(p, storeName, MX + 14, 30, f.r800, 19, C_NAVY);
  dt(p, "by Meijrverse\xb0", MX + 14, 58, f.r400, 9, C_BYLINE);

  const title = "LABA & MARGIN";
  const tSp = 1.4, tSz = 14;
  dtSpaced(p, title, RIGHT - spacedWidth(title, f.r800, tSz, tSp), 30, f.r800, tSz, C_TEAL, tSp);

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

// ── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const report = await getOwnerReportSummary(range);
  const summary = serializeProfitSummary(report.profit);
  const periodLabel = labelForRange(range);
  const storeName = report.settings.storeName;
  const printedAt = formatDateTimeID(new Date());

  const doc = await PDFDocument.create();
  const f = await loadInterFonts(doc);
  const pages: PDFPage[] = [];

  function startPage(): PDFPage {
    const p = doc.addPage([PW, PH]);
    pages.push(p);
    drawHeader(p, f, storeName, periodLabel, printedAt);
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

  // ── Table layout (mirrors the on-screen detail table) ──────────────────────
  type Col = { label: string; x: number; right?: boolean; maxW?: number };
  const cols: Col[] = [
    { label: "Produk",       x: MX + 14,  maxW: 100 },
    { label: "SKU",          x: 164,      maxW: 44 },
    { label: "Qty",          x: 236, right: true },
    { label: "Omzet Bersih", x: 296, right: true, maxW: 56 },
    { label: "HPP Bersih",   x: 356, right: true, maxW: 56 },
    { label: "Laba",         x: 420, right: true, maxW: 60 },
    { label: "Margin",       x: 464, right: true, maxW: 38 },
    { label: "Status",       x: 470 },
  ];
  const HROW = 26, ROWH = 24;
  const STATUS_X = 470;
  const STATUS_MAXW = RIGHT - STATUS_X; // 85

  function tableHead() {
    rounded(page, MX, y, CW, HROW, 4, C_NAVY);
    for (const c of cols) rowText(page, c.label, c.x, y, HROW, f.r700, 7, C_WHITE, c.right);
    y += HROW;
  }

  function drawStatus(status: string, rowTopY: number) {
    const { bg, fg } = statusPill(status);
    const size = 6.5;
    const label = cutW(status, f.r700, size, STATUS_MAXW - 10);
    const tw = f.r700.widthOfTextAtSize(label, size);
    const pillW = Math.min(tw + 12, STATUS_MAXW);
    const pillH = 14;
    const pillTop = rowTopY + (ROWH - pillH) / 2;
    rounded(page, STATUS_X, pillTop, pillW, pillH, pillH / 2, bg);
    rowText(page, label, STATUS_X + 6, pillTop, pillH, f.r700, size, fg);
  }

  // ── RINGKASAN ──────────────────────────────────────────────────────────────
  sectionTitle("Ringkasan");
  metricRow([
    { label: "Omzet Bersih", value: summary.netRevenue, helper: "Setelah retur",   accent: C_TEAL },
    { label: "HPP Bersih",   value: summary.netCogs,    helper: "Modal terjual",    accent: C_BLUE },
    { label: "Laba Kotor",   value: summary.netProfit,  helper: `Margin ${summary.margin}`, accent: C_TEAL },
  ]);
  metricRow([
    { label: "Omzet Kotor",    value: summary.grossRevenue,  helper: "Sebelum retur",  accent: C_TEAL },
    { label: "Retur Customer", value: summary.returnRevenue, helper: "Nilai refund",   accent: C_ROSE },
    { label: "Margin",         value: summary.margin,        helper: "Laba / omzet",   accent: C_AMBER },
  ]);
  y += 4;

  // ── Warning banner (HPP retur belum lengkap) ───────────────────────────────
  if (summary.returnCostWarning) {
    const bannerH = 30;
    rounded(page, MX, y, CW, bannerH, 6, rgb(0.996, 0.984, 0.918), rgb(0.992, 0.906, 0.541));
    rowText(page, cutW(summary.returnCostWarning, f.r600, 7.5, CW - 28), MX + 14, y, bannerH, f.r600, 7.5, C_AMBER_FG);
    y += bannerH + 12;
  }

  // ── DETAIL PER PRODUK ──────────────────────────────────────────────────────
  sectionTitle("Detail Per Produk");
  tableHead();

  if (!summary.hasUnitCostSnapshot || summary.products.length === 0) {
    dr(page, MX, y, CW, ROWH, C_WHITE, C_BORDER);
    rowText(
      page,
      summary.hasUnitCostSnapshot
        ? "Tidak ada data laba & margin untuk periode ini."
        : "Data snapshot HPP belum tersedia.",
      MX + 14, y, ROWH, f.r400, 8, C_MUTED,
    );
    y += ROWH;
  } else {
    summary.products.forEach((product, idx) => {
      if (y + ROWH > CONTENT_BOTTOM) {
        page = startPage();
        y = CONTENT_TOP;
        sectionTitle("Detail Per Produk (lanjutan)");
        tableHead();
      }
      dr(page, MX, y, CW, ROWH, idx % 2 === 0 ? C_WHITE : C_STRIPE, C_BORDER);
      rowText(page, cutW(product.name, f.r600, 8, 100), MX + 14, y, ROWH, f.r600, 8, C_NAVY);
      rowText(page, cutW(product.sku, f.r400, 8, 44), 164, y, ROWH, f.r400, 8, C_MUTED);
      rowText(page, String(product.netQty), 236, y, ROWH, f.r400, 8, C_SLATE, true);
      rowText(page, cutW(product.netRevenue, f.r400, 8, 56), 296, y, ROWH, f.r400, 8, C_SLATE, true);
      rowText(page, cutW(product.netCogs, f.r400, 8, 56), 356, y, ROWH, f.r400, 8, C_SLATE, true);
      rowText(page, cutW(product.profit, f.r700, 8, 60), 420, y, ROWH, f.r700, 8, C_TEAL, true);
      rowText(page, product.marginValid ? product.margin : "N/A", 464, y, ROWH, f.r600, 8, C_SLATE, true);
      drawStatus(product.status, y);
      y += ROWH;
    });
  }

  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, f, storeName, i + 1, total));

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(range)}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function parseBusinessDate(value: string | null, end = false) {
  if (!value || !BUSINESS_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (end) date.setHours(23, 59, 59, 999); else date.setHours(0, 0, 0, 0);
  return date;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function todayRange(): OwnerReportRange {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setHours(23, 59, 59, 999);
  return { from, to };
}

function resolveRange(sp: URLSearchParams): OwnerReportRange {
  const from = parseBusinessDate(sp.get("from"));
  const to = parseBusinessDate(sp.get("to"), true);
  if (!from || !to || from > to) return todayRange();
  return { from, to };
}

function labelForRange(range: OwnerReportRange) {
  if (!range.from || !range.to) return "Periode laporan";
  if (dateInputValue(range.from) === dateInputValue(range.to)) return formatDateID(range.from);
  return `${formatDateID(range.from)} - ${formatDateID(range.to)}`;
}

function filename(range: OwnerReportRange) {
  if (!range.from || !range.to) return `laba-margin-${dateInputValue(new Date())}.pdf`;
  const from = dateInputValue(range.from);
  const to = dateInputValue(range.to);
  return from === to ? `laba-margin-${from}.pdf` : `laba-margin-${from}-to-${to}.pdf`;
}
