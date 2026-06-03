import { requireOwner } from "@/lib/auth-session";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { serializeProfitSummary } from "@/lib/report-profit-detail";
import { getOwnerReportSummary, type OwnerReportRange } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Layout (Landscape A4) ─────────────────────────────────────────────────────
const PW = 842;
const PH = 595;
const MX = 28;
const CW = PW - MX * 2; // 786

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = "#0F172A";
const SLATE  = "#334155";
const MUTED  = "#94A3B8";
const BORDER = "#E2E8F0";
const TEAL   = "#0F9F8A";
const ROSE   = "#BE123C";
const STRIPE = "#F8FAFC";
const HDR_BG = "#F1F5F9";

// ── PDF primitives ────────────────────────────────────────────────────────────
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function escapeText(v: string) {
  return v.replace(/[^\x20-\x7E]/g," ").replaceAll("\\","\\\\").replaceAll("(",`\\(`).replaceAll(")",`\\)`);
}

function color(hex: string) {
  const v = hex.replace("#","");
  return [0,2,4].map(i => (parseInt(v.slice(i,i+2),16)/255).toFixed(3)).join(" ");
}

function text(v: string, x: number, y: number, size = 8, font = "F1", fill = NAVY) {
  return ["BT",`/${font} ${size} Tf`,`${color(fill)} rg`,`${x} ${PH-y} Td`,`(${escapeText(v)}) Tj`,"ET"].join("\n");
}

function rect(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  const yy = PH - y - h;
  if (!stroke) return `${color(fill)} rg\n${x} ${yy} ${w} ${h} re f`;
  return [`${color(fill)} rg`,`${color(stroke)} RG`,"0.5 w",`${x} ${yy} ${w} ${h} re B`].join("\n");
}

function line(x1: number, y1: number, x2: number, y2: number, stroke = BORDER, lw = 0.5) {
  return `${color(stroke)} RG\n${lw} w\n${x1} ${PH-y1} m\n${x2} ${PH-y2} l\nS`;
}

function trunc(v: string, max = 16) {
  return v.length > max ? v.slice(0, max-3)+"..." : v;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseBusinessDate(value: string | null, end = false) {
  if (!value || !BUSINESS_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month-1, day);
  if (Number.isNaN(date.getTime()) || date.getFullYear()!==year || date.getMonth()!==month-1 || date.getDate()!==day) return null;
  if (end) date.setHours(23,59,59,999); else date.setHours(0,0,0,0);
  return date;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes()-local.getTimezoneOffset());
  return local.toISOString().slice(0,10);
}

function fmtDate(date: Date) { return formatDateID(date); }
function fmtDateTime(date: Date) { return formatDateTimeID(date); }

function todayRange(): OwnerReportRange {
  const from = new Date(); from.setHours(0,0,0,0);
  const to   = new Date(from); to.setHours(23,59,59,999);
  return { from, to };
}

function resolveRange(sp: URLSearchParams) {
  const from = parseBusinessDate(sp.get("from"));
  const to   = parseBusinessDate(sp.get("to"), true);
  if (!from || !to || from > to) return todayRange();
  return { from, to } satisfies OwnerReportRange;
}

function periodLabel(range: OwnerReportRange) {
  if (!range.from || !range.to) return "Periode laporan";
  if (dateInputValue(range.from) === dateInputValue(range.to)) return fmtDate(range.from);
  return `${fmtDate(range.from)} - ${fmtDate(range.to)}`;
}

function filename(range: OwnerReportRange) {
  if (!range.from || !range.to) return `laba-margin-${dateInputValue(new Date())}.pdf`;
  const from = dateInputValue(range.from);
  const to   = dateInputValue(range.to);
  return from===to ? `laba-margin-${from}.pdf` : `laba-margin-${from}-to-${to}.pdf`;
}

// ── Design components ─────────────────────────────────────────────────────────

// Compact landscape header
function pageHeader(storeName: string, label: string) {
  return [
    // Teal left accent bar
    rect(MX, 14, 4, 48, TEAL),
    // Store name + subtitle
    text(storeName.toUpperCase(), MX+12, 36, 12, "F2", NAVY),
    text("Detail Laba & Margin", MX+12, 52, 8.5, "F1", MUTED),
    // Right meta
    text("PERIODE", 668, 24, 6.5, "F2", MUTED),
    text(label, 668, 38, 8, "F2", NAVY),
    text("DICETAK", 750, 24, 6.5, "F2", MUTED),
    text(fmtDateTime(new Date()), 750, 38, 7, "F1", SLATE),
    // Bottom rule
    line(MX, 72, PW-MX, 72, TEAL, 1),
  ].join("\n");
}

// Metric card (landscape proportions, 6 cols in summary strip)
function metricCard(x: number, y: number, w: number, label: string, value: string, accent = TEAL) {
  const H = 44;
  return [
    rect(x, y, w, H, "#FFFFFF", BORDER),
    rect(x, y, 3, H, accent),
    text(label, x+10, y+15, 6.5, "F2", MUTED),
    text(value,  x+10, y+33, 9,   "F2", NAVY),
  ].join("\n");
}

// Section title
function sectionTitle(label: string, y: number) {
  return [
    rect(MX, y, CW, 20, HDR_BG),
    rect(MX, y, 3, 20, TEAL),
    text(label.toUpperCase(), MX+10, y+14, 8, "F2", NAVY),
  ].join("\n");
}

// Table header (landscape, 14 columns, small font)
function tableHeader(y: number) {
  const cols: [string, number][] = [
    ["Produk",        MX+6],
    ["SKU",           136],
    ["Qty Jual",      188],
    ["Qty Retur",     222],
    ["Qty Net",       260],
    ["Omzet Kotor",   296],
    ["Retur",         360],
    ["Omzet Bersih",  416],
    ["HPP Jual",      484],
    ["HPP Retur",     546],
    ["HPP Bersih",    612],
    ["Laba",          670],
    ["Margin",        726],
    ["Status",        770],
  ];
  return [
    rect(MX, y, CW, 22, NAVY),
    ...cols.map(([label, x]) => text(label, x, y+14, 6, "F2", "#FFFFFF")),
  ].join("\n");
}

// Table row (landscape, 22px height, alternating)
function tableRow(
  y: number,
  row: {
    name: string; sku: string;
    soldQty: number; returnQty: number; netQty: number;
    grossRevenue: string; returnRevenue: string; netRevenue: string;
    salesCogs: string; returnCogs: string; netCogs: string;
    profit: string; margin: string; marginValid: boolean; status: string;
  },
  fill: string,
) {
  const H = 22;
  return [
    rect(MX, y, CW, H, fill, BORDER),
    text(trunc(row.name,         20), MX+6,  y+14, 6, "F2", NAVY),
    text(trunc(row.sku,           9), 136,   y+14, 6, "F1", MUTED),
    text(String(row.soldQty),        188,   y+14, 6, "F1", NAVY),
    text(String(row.returnQty),      222,   y+14, 6, "F1", NAVY),
    text(String(row.netQty),         260,   y+14, 6, "F1", NAVY),
    text(trunc(row.grossRevenue, 13),296,   y+14, 6, "F1", NAVY),
    text(trunc(row.returnRevenue,12),360,   y+14, 6, "F1", ROSE),
    text(trunc(row.netRevenue,   13),416,   y+14, 6, "F1", NAVY),
    text(trunc(row.salesCogs,    12),484,   y+14, 6, "F1", NAVY),
    text(trunc(row.returnCogs,   12),546,   y+14, 6, "F1", ROSE),
    text(trunc(row.netCogs,      12),612,   y+14, 6, "F1", NAVY),
    text(trunc(row.profit,       12),670,   y+14, 6, "F2", TEAL),
    text(row.marginValid ? row.margin : "N/A", 726, y+14, 6, "F1", NAVY),
    text(trunc(row.status,       14),770,   y+14, 6, "F1", MUTED),
  ].join("\n");
}

// Page footer
function pageFooter(page: number, total: number) {
  return [
    line(MX, 567, PW-MX, 567, BORDER, 0.5),
    text("MEIJRVERSE POS", MX, 582, 7, "F2", MUTED),
    text(`Halaman ${page} dari ${total}`, PW-MX-55, 582, 7, "F1", MUTED),
  ].join("\n");
}

// ── PDF assembler ─────────────────────────────────────────────────────────────
function buildPdfPages(pages: string[]) {
  const pageObjects = pages.flatMap((content, index) => {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content,"utf8")} >>\nstream\n${content}\nendstream`,
    ];
  });
  const kids = pages.map((_,i) => `${5+i*2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...pageObjects,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf,"utf8")); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf,"utf8");
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for (const off of offsets.slice(1)) pdf += `${String(off).padStart(10,"0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf,"utf8");
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const url    = new URL(req.url);
  const range  = resolveRange(url.searchParams);
  const report = await getOwnerReportSummary(range);
  const summary = serializeProfitSummary(report.profit);
  const label   = periodLabel(range);
  const storeName = report.settings.storeName;

  const pages: string[][] = [[pageHeader(storeName, label)]];

  // ── Summary metric strip ──────────────────────────────────────────────────
  const cardY = 84;
  const cardW  = 93;
  const cardGap = 4;
  pages[0].push(
    metricCard(MX,                          cardY, cardW, "Omzet Kotor",    summary.grossRevenue,  TEAL),
    metricCard(MX + (cardW+cardGap),        cardY, cardW, "Retur Customer", summary.returnRevenue, "#E11D48"),
    metricCard(MX + (cardW+cardGap)*2,      cardY, cardW, "Omzet Bersih",  summary.netRevenue,    TEAL),
    metricCard(MX + (cardW+cardGap)*3,      cardY, cardW, "HPP Penjualan", summary.salesCogs,     "#3B82F6"),
    metricCard(MX + (cardW+cardGap)*4,      cardY, cardW, "HPP Retur",     summary.returnCogs,    "#E11D48"),
    metricCard(MX + (cardW+cardGap)*5,      cardY, cardW, "HPP Bersih",    summary.netCogs,       "#3B82F6"),
    metricCard(MX + (cardW+cardGap)*6,      cardY, cardW, "Laba Kotor",    summary.netProfit,     TEAL),
    metricCard(MX + (cardW+cardGap)*7,      cardY, 62,    "Margin",        summary.margin,        "#D97706"),
  );

  let y = 140;

  // ── Warning banner (if applicable) ────────────────────────────────────────
  if (summary.returnCostWarning) {
    pages[0].push(
      rect(MX, y, CW, 26, "#FFFBEB", "#FDE68A"),
      text(summary.returnCostWarning, MX+10, y+17, 7, "F2", "#92400E"),
    );
    y += 36;
  }

  // ── Table section title ────────────────────────────────────────────────────
  pages[0].push(sectionTitle("Detail Per Produk", y));
  y += 26;

  pages[0].push(tableHeader(y));
  y += 22;

  // ── Product rows ────────────────────────────────────────────────────────────
  if (!summary.hasUnitCostSnapshot || summary.products.length === 0) {
    pages[0].push(
      rect(MX, y, CW, 28, "#FFFFFF", BORDER),
      text(
        summary.hasUnitCostSnapshot
          ? "Tidak ada data laba dan margin untuk periode ini."
          : "Data snapshot HPP belum tersedia.",
        MX+10, y+18, 8, "F1", MUTED,
      ),
    );
  } else {
    summary.products.forEach((product, index) => {
      // Page break threshold (landscape height 595, footer at 567)
      if (y > 518) {
        pages.push([
          pageHeader(storeName, label),
          sectionTitle("Detail Per Produk (lanjutan)", 84),
          tableHeader(108),
        ]);
        y = 130;
      }
      pages[pages.length-1].push(
        tableRow(y, product, index % 2 === 0 ? "#FFFFFF" : STRIPE),
      );
      y += 22;
    });
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const finalPages = pages.map((page, i) =>
    [...page, pageFooter(i+1, pages.length)].join("\n"),
  );

  return new NextResponse(new Uint8Array(buildPdfPages(finalPages)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(range)}"`,
      "Cache-Control": "no-store",
    },
  });
}
