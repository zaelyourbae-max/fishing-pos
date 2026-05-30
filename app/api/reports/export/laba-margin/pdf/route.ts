import { requireOwner } from "@/lib/auth-session";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { serializeProfitSummary } from "@/lib/report-profit-detail";
import { getOwnerReportSummary, type OwnerReportRange } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_X = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAVY = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const TEAL = "#0F9F8A";
const SOFT_TEAL = "#ECFDF5";
const SOFT_ROSE = "#FFF1F2";
const SOFT_AMBER = "#FFFBEB";

function escapeText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function color(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function text(
  value: string,
  x: number,
  y: number,
  size = 8,
  font = "F1",
  fill = NAVY,
) {
  return [
    "BT",
    `/${font} ${size} Tf`,
    `${color(fill)} rg`,
    `${x} ${PAGE_HEIGHT - y} Td`,
    `(${escapeText(value)}) Tj`,
    "ET",
  ].join("\n");
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke?: string,
) {
  const yy = PAGE_HEIGHT - y - height;

  if (!stroke) {
    return `${color(fill)} rg\n${x} ${yy} ${width} ${height} re f`;
  }

  return [
    `${color(fill)} rg`,
    `${color(stroke)} RG`,
    "0.7 w",
    `${x} ${yy} ${width} ${height} re B`,
  ].join("\n");
}

function line(x1: number, y1: number, x2: number, y2: number, stroke = BORDER) {
  return `${color(stroke)} RG\n0.7 w\n${x1} ${PAGE_HEIGHT - y1} m\n${x2} ${PAGE_HEIGHT - y2} l\nS`;
}

function truncate(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function parseBusinessDate(value: string | null, end = false) {
  if (!value || !BUSINESS_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (end) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return formatDateID(date);
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function todayRange(): OwnerReportRange {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function resolveRange(searchParams: URLSearchParams) {
  const from = parseBusinessDate(searchParams.get("from"));
  const to = parseBusinessDate(searchParams.get("to"), true);

  if (!from || !to || from > to) {
    return todayRange();
  }

  return { from, to } satisfies OwnerReportRange;
}

function periodLabel(range: OwnerReportRange) {
  if (!range.from || !range.to) {
    return "Periode laporan";
  }

  if (dateInputValue(range.from) === dateInputValue(range.to)) {
    return formatDate(range.from);
  }

  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

function filename(range: OwnerReportRange) {
  if (!range.from || !range.to) {
    return `laba-margin-${dateInputValue(new Date())}.pdf`;
  }

  const from = dateInputValue(range.from);
  const to = dateInputValue(range.to);

  return from === to ? `laba-margin-${from}.pdf` : `laba-margin-${from}-to-${to}.pdf`;
}

function tableHeader(y: number) {
  const labels = [
    ["Produk", 36],
    ["SKU", 124],
    ["Qty Jual", 174],
    ["Qty Retur", 210],
    ["Qty Net", 250],
    ["Omzet Kotor", 290],
    ["Retur", 354],
    ["Omzet Bersih", 410],
    ["HPP Jual", 478],
    ["HPP Retur", 540],
    ["HPP Bersih", 606],
    ["Laba", 670],
    ["Margin", 728],
    ["Status", 770],
  ] as const;

  return [
    rect(MARGIN_X, y, CONTENT_WIDTH, 20, NAVY),
    ...labels.map(([label, x]) => text(label, x, y + 13, 6, "F2", "#FFFFFF")),
  ].join("\n");
}

function tableRow(
  y: number,
  row: {
    name: string;
    sku: string;
    soldQty: number;
    returnQty: number;
    netQty: number;
    grossRevenue: string;
    returnRevenue: string;
    netRevenue: string;
    salesCogs: string;
    returnCogs: string;
    netCogs: string;
    profit: string;
    margin: string;
    marginValid: boolean;
    status: string;
  },
  fill: string,
) {
  return [
    rect(MARGIN_X, y, CONTENT_WIDTH, 22, fill, BORDER),
    text(truncate(row.name, 18), 36, y + 14, 6, "F2"),
    text(truncate(row.sku, 9), 124, y + 14, 6, "F1", MUTED),
    text(String(row.soldQty), 190, y + 14, 6, "F1", NAVY),
    text(String(row.returnQty), 228, y + 14, 6, "F1", NAVY),
    text(String(row.netQty), 266, y + 14, 6, "F1", NAVY),
    text(truncate(row.grossRevenue, 12), 290, y + 14, 6, "F1", NAVY),
    text(truncate(row.returnRevenue, 11), 354, y + 14, 6, "F1", "#BE123C"),
    text(truncate(row.netRevenue, 12), 410, y + 14, 6, "F1", NAVY),
    text(truncate(row.salesCogs, 11), 478, y + 14, 6, "F1", NAVY),
    text(truncate(row.returnCogs, 11), 540, y + 14, 6, "F1", "#BE123C"),
    text(truncate(row.netCogs, 11), 606, y + 14, 6, "F1", NAVY),
    text(truncate(row.profit, 11), 670, y + 14, 6, "F2", TEAL),
    text(row.marginValid ? row.margin : "Tidak valid", 728, y + 14, 6, "F1", NAVY),
    text(truncate(row.status, 13), 770, y + 14, 6, "F1", MUTED),
  ].join("\n");
}

function metricCard(
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  fill = SOFT_TEAL,
) {
  return [
    rect(x, y, width, 46, "#FFFFFF", BORDER),
    rect(x + 10, y + 14, 18, 18, fill),
    text(label, x + 36, y + 17, 6.5, "F1", MUTED),
    text(value, x + 36, y + 34, 9, "F2", NAVY),
  ].join("\n");
}

function pageHeader(storeName: string, label: string) {
  return [
    text(storeName.toUpperCase(), MARGIN_X, 32, 15, "F2", TEAL),
    text("Detail Laba & Margin", MARGIN_X, 52, 10, "F2", NAVY),
    text(`Periode: ${label}`, 610, 34, 8, "F2", NAVY),
    text(`Tanggal cetak: ${formatDateTime(new Date())}`, 610, 50, 7, "F1", MUTED),
    line(MARGIN_X, 72, PAGE_WIDTH - MARGIN_X, 72, "#99D6CB"),
  ].join("\n");
}

function pageFooter(page: number, total: number) {
  return [
    line(MARGIN_X, 560, PAGE_WIDTH - MARGIN_X, 560),
    text("Generated by Meijrverse POS", MARGIN_X, 578, 7, "F1", MUTED),
    text(`Halaman ${page} dari ${total}`, 760, 578, 7, "F1", MUTED),
  ].join("\n");
}

function buildPdfPages(pages: string[]) {
  const pageObjects = pages.flatMap((content, index) => {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;

    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];
  });
  const kids = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...pageObjects,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const report = await getOwnerReportSummary(range);
  const summary = serializeProfitSummary(report.profit);
  const label = periodLabel(range);
  const pages: string[][] = [[pageHeader(report.settings.storeName, label)]];

  pages[0].push(
    metricCard(28, 94, 96, "Omzet Kotor", summary.grossRevenue),
    metricCard(132, 94, 96, "Retur Customer", summary.returnRevenue, SOFT_ROSE),
    metricCard(236, 94, 96, "Omzet Bersih", summary.netRevenue),
    metricCard(340, 94, 96, "HPP Penjualan", summary.salesCogs),
    metricCard(444, 94, 96, "HPP Retur", summary.returnCogs, SOFT_ROSE),
    metricCard(548, 94, 96, "HPP Bersih", summary.netCogs),
    metricCard(652, 94, 96, "Laba Kotor", summary.netProfit),
    metricCard(756, 94, 58, "Margin", summary.margin, SOFT_AMBER),
  );

  let y = 164;

  if (summary.returnCostWarning) {
    pages[0].push(
      rect(MARGIN_X, y, CONTENT_WIDTH, 28, SOFT_AMBER, "#FDE68A"),
      text(summary.returnCostWarning, MARGIN_X + 10, y + 18, 7, "F2", "#92400E"),
    );
    y += 42;
  }

  pages[0].push(tableHeader(y));
  y += 20;

  if (!summary.hasUnitCostSnapshot || summary.products.length === 0) {
    pages[0].push(
      rect(MARGIN_X, y, CONTENT_WIDTH, 28, "#FFFFFF", BORDER),
      text(
        summary.hasUnitCostSnapshot
          ? "Tidak ada data laba dan margin untuk periode ini."
          : "Data snapshot HPP belum tersedia.",
        MARGIN_X + 10,
        y + 18,
        8,
        "F1",
        MUTED,
      ),
    );
  } else {
    summary.products.forEach((product, index) => {
      if (y > 526) {
        pages.push([pageHeader(report.settings.storeName, label), tableHeader(94)]);
        y = 114;
      }

      pages[pages.length - 1].push(
        tableRow(y, product, index % 2 === 0 ? "#FFFFFF" : "#F8FAFC"),
      );
      y += 22;
    });
  }

  const finalPages = pages.map((page, index) =>
    [...page, pageFooter(index + 1, pages.length)].join("\n"),
  );

  return new NextResponse(new Uint8Array(buildPdfPages(finalPages)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(range)}"`,
      "Cache-Control": "no-store",
    },
  });
}
