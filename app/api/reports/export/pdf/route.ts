import { requireOwner } from "@/lib/auth-session";
import {
  getOwnerReportSummary,
  getOwnerReportTransactions,
  type OwnerReportRange,
  reportDateStamp,
  rupiah,
} from "@/lib/reports";
import { operatorLabel } from "@/lib/transaction-identity";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const NAVY = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const TEAL = "#0F9F8A";
const SOFT_TEAL = "#ECFDF5";
const SOFT_BLUE = "#EFF6FF";
const SOFT_ROSE = "#FFF1F2";
const SOFT_AMBER = "#FFFBEB";
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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
  size = 10,
  font = "F1",
  fill = "#0F172A",
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
    "0.8 w",
    `${x} ${yy} ${width} ${height} re B`,
  ].join("\n");
}

function line(x1: number, y1: number, x2: number, y2: number, stroke = "#E2E8F0") {
  return `${color(stroke)} RG\n0.8 w\n${x1} ${PAGE_HEIGHT - y1} m\n${x2} ${PAGE_HEIGHT - y2} l\nS`;
}

function metricCard(
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  helper = "",
  accent = SOFT_TEAL,
) {
  return [
    rect(x, y, width, 64, "#FFFFFF", BORDER),
    rect(x + 12, y + 18, 22, 22, accent),
    text(label, x + 44, y + 19, 7.5, "F2", MUTED),
    text(value, x + 44, y + 39, 13, "F2", NAVY),
    helper ? text(helper, x + 44, y + 55, 7.5, "F1", MUTED) : "",
  ].join("\n");
}

function truncate(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function parseBusinessDate(value: string | null, end = false) {
  if (!value) {
    return undefined;
  }

  if (!BUSINESS_DATE_PATTERN.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  if (end) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function resolveExportDate(searchParams: URLSearchParams) {
  const selectedDate = searchParams.get("date");

  if (selectedDate && BUSINESS_DATE_PATTERN.test(selectedDate)) {
    const from = parseBusinessDate(selectedDate);
    const to = parseBusinessDate(selectedDate, true);

    if (from && to) {
      return {
        range: {
          from,
          to,
        } satisfies OwnerReportRange,
        periodLabel: formatDate(from),
        filenameDate: selectedDate,
      };
    }
  }

  const fromKey = searchParams.get("from");
  const toKey = searchParams.get("to");
  const from = parseBusinessDate(fromKey);
  const to = parseBusinessDate(toKey, true);
  const range: OwnerReportRange = {
    from,
    to,
  };
  const periodLabel =
    from || to ? `${formatDate(from)} - ${formatDate(to)}` : "Bulan ini";
  return {
    range,
    periodLabel,
    filenameDate: reportDateStamp(),
  };
}

function formatDate(date?: Date) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function tableHeader(
  y: number,
  columns: { label: string; x: number; width: number }[],
) {
  return [
    rect(MARGIN_X, y, CONTENT_WIDTH, 26, NAVY),
    ...columns.map((column) =>
      text(column.label, column.x, y + 17, 8, "F2", "#FFFFFF"),
    ),
  ].join("\n");
}

function tableRow(
  y: number,
  columns: { value: string; x: number; max?: number; right?: boolean }[],
  fill = "#FFFFFF",
  font = "F1",
  textColor = "#334155",
) {
  return [
    rect(MARGIN_X, y, CONTENT_WIDTH, 28, fill, BORDER),
    ...columns.map((column) => {
      const value = truncate(column.value, column.max ?? 18);
      const x = column.right ? column.x - value.length * 4.15 : column.x;

      return text(value, x, y + 18, 8, font, textColor);
    }),
  ].join("\n");
}

function buildPdfPages(pages: string[]) {
  const pageObjects = pages.flatMap((content, index) => {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;

    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
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

function pageFooter(page: number, total: number) {
  return [
    line(MARGIN_X, 790, PAGE_WIDTH - MARGIN_X, 790),
    text("Generated by Meijrverse POS", MARGIN_X, 810, 8, "F1", MUTED),
    text(`Generated at ${formatDateTime(new Date())}`, 220, 810, 8, "F1", MUTED),
    text(`Halaman ${page} dari ${total}`, 490, 810, 8, "F1", MUTED),
  ].join("\n");
}

function reportHeader(storeName: string, periodLabel: string) {
  return [
    text(storeName.toUpperCase(), MARGIN_X, 48, 22, "F2", TEAL),
    text("Laporan Owner", MARGIN_X, 72, 13, "F1", "#475569"),
    text("Tanggal cetak", 360, 42, 8, "F1", MUTED),
    text(formatDateTime(new Date()), 360, 58, 9, "F2", NAVY),
    text("Periode laporan", 462, 42, 8, "F1", MUTED),
    text(periodLabel, 462, 58, 9, "F2", NAVY),
    line(MARGIN_X, 98, PAGE_WIDTH - MARGIN_X, 98, "#99D6CB"),
  ].join("\n");
}

function sectionTitle(label: string, y: number) {
  return text(label.toUpperCase(), MARGIN_X, y, 11, "F2", NAVY);
}

function addRows(
  pages: string[][],
  yRef: { value: number },
  rows: string[][],
  columns: { label: string; x: number; max?: number; right?: boolean }[],
  header: () => string[],
) {
  for (const row of rows) {
    if (yRef.value > 738) {
      pages.push(header());
      yRef.value = 126;
      pages[pages.length - 1].push(
        tableHeader(yRef.value, columns.map((column) => ({
          label: column.label,
          x: column.x,
          width: 80,
        }))),
      );
      yRef.value += 28;
    }

    pages[pages.length - 1].push(
      tableRow(
        yRef.value,
        row.map((value, index) => ({
          value,
          x: columns[index].x,
          max: columns[index].max,
          right: columns[index].right,
        })),
      ),
    );
    yRef.value += 28;
  }
}

export async function GET(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(req.url);
  const { range, periodLabel, filenameDate } = resolveExportDate(
    url.searchParams,
  );
  const [report, transactions] = await Promise.all([
    getOwnerReportSummary(range),
    getOwnerReportTransactions(60, range),
  ]);
  const paymentRows = report.month.paymentSummary.map((item) => ({
    period: periodLabel,
    method: item.paymentLabel,
    transactions: item.transactions,
    total: item.total,
  }));
  const paymentTotal = paymentRows.reduce((total, item) => total + item.total, 0);
  const paymentTransactions = paymentRows.reduce(
    (total, item) => total + item.transactions,
    0,
  );
  const pages: string[][] = [[reportHeader(report.settings.storeName, periodLabel)]];
  let y = 132;
  pages[0].push(
    sectionTitle("Ringkasan", y),
    metricCard(
      40,
      154,
      160,
      "Omzet Kotor",
      rupiah(report.month.grossOmzet),
      "Sebelum retur",
      SOFT_TEAL,
    ),
    metricCard(
      218,
      154,
      150,
      "Omzet Bersih",
      rupiah(report.month.netOmzet),
      "Setelah retur",
      SOFT_TEAL,
    ),
    metricCard(
      386,
      154,
      169,
      "Total Transaksi",
      String(report.month.transactions),
      "Transaksi periode",
      SOFT_BLUE,
    ),
    metricCard(
      40,
      232,
      160,
      "ATV",
      rupiah(report.month.averageTransaction),
      "Rata-rata transaksi",
      SOFT_BLUE,
    ),
    metricCard(
      218,
      232,
      150,
      "Total Pembelian",
      rupiah(report.inventoryReturns.totalPurchaseMonth),
      "Pembelian periode",
      SOFT_AMBER,
    ),
    metricCard(
      386,
      232,
      169,
      "Retur Supplier",
      rupiah(report.inventoryReturns.monthValue),
      "Inventory-side",
      SOFT_AMBER,
    ),
    sectionTitle("Retur", 326),
    metricCard(
      40,
      348,
      160,
      "Jumlah Retur",
      String(report.month.returnCount),
      "Customer return",
      SOFT_ROSE,
    ),
    metricCard(
      218,
      348,
      150,
      "Nilai Retur",
      rupiah(report.month.returnValue),
      "Total refund",
      SOFT_ROSE,
    ),
    metricCard(
      386,
      348,
      169,
      "Alasan Terbanyak",
      report.returns.topReason?.label ?? "-",
      "Reason summary",
      SOFT_AMBER,
    ),
  );

  y = 450;
  pages[0].push(
    sectionTitle("Payment Summary", y),
    tableHeader(470, [
      { label: "Periode", x: 52, width: 90 },
      { label: "Payment", x: 150, width: 120 },
      { label: "Transaksi", x: 300, width: 80 },
      { label: "Total Omzet", x: 420, width: 120 },
    ]),
  );

  y = 496;
  if (paymentRows.length === 0) {
    pages[0].push(tableRow(y, [{ value: "Belum ada transaksi", x: 52, max: 60 }]));
    y += 28;
  } else {
    for (const item of paymentRows.slice(0, 6)) {
      pages[0].push(
        tableRow(y, [
          { value: item.period, x: 52, max: 14 },
          { value: item.method, x: 150, max: 18 },
          { value: String(item.transactions), x: 300, max: 8 },
          { value: rupiah(item.total), x: 535, max: 18, right: true },
        ]),
      );
      y += 28;
    }
    pages[0].push(
      tableRow(
        y,
        [
          { value: "Total", x: 52, max: 14 },
          { value: `${paymentRows.length} Metode`, x: 150, max: 18 },
          { value: String(paymentTransactions), x: 300, max: 8 },
          { value: rupiah(paymentTotal), x: 535, max: 18, right: true },
        ],
        SOFT_TEAL,
        "F2",
        TEAL,
      ),
    );
    y += 28;
  }

  y = Math.max(y + 30, 652);
  pages[0].push(
    sectionTitle("Top Produk", y),
    tableHeader(y + 20, [
      { label: "Produk", x: 52, width: 190 },
      { label: "SKU", x: 250, width: 84 },
      { label: "Qty", x: 350, width: 48 },
      { label: "Omzet", x: 454, width: 88 },
    ]),
  );
  y += 44;
  const topRows = report.bestSellers.length
    ? report.bestSellers.map((item) => [
        item.name,
        item.sku,
        String(item.qty),
        rupiah(item.total),
      ])
    : [["Belum ada produk terjual", "-", "-", "-"]];

  addRows(
    pages,
    { get value() { return y; }, set value(next) { y = next; } },
    topRows,
    [
      { label: "Produk", x: 52, max: 26 },
      { label: "SKU", x: 250, max: 16 },
      { label: "Qty", x: 350, max: 8 },
      { label: "Omzet", x: 540, max: 16, right: true },
    ],
    () => [
      reportHeader(report.settings.storeName, periodLabel),
      sectionTitle("Top Produk", 112),
    ],
  );

  pages.push([
    reportHeader(report.settings.storeName, periodLabel),
    sectionTitle("Transaksi Terakhir", 112),
    tableHeader(132, [
      { label: "Invoice", x: 52, width: 88 },
      { label: "Tanggal", x: 142, width: 92 },
      { label: "Customer", x: 238, width: 84 },
      { label: "Operator", x: 325, width: 72 },
      { label: "Payment", x: 400, width: 58 },
      { label: "Total", x: 463, width: 78 },
    ]),
  ]);
  y = 158;

  if (transactions.length === 0) {
    pages[pages.length - 1].push(tableRow(y, [{ value: "Belum ada transaksi periode ini", x: 52, max: 60 }]));
  } else {
    addRows(
      pages,
      { get value() { return y; }, set value(next) { y = next; } },
      transactions.map((sale) => [
        sale.invoiceNumber,
        formatDateTime(sale.createdAt),
        sale.customer?.name ?? "Walk-in",
        operatorLabel(sale.cashier),
        sale.paymentLabel,
        rupiah(sale.subtotal),
      ]),
      [
        { label: "Invoice", x: 52, max: 14 },
        { label: "Tanggal", x: 142, max: 18 },
        { label: "Customer", x: 238, max: 14 },
        { label: "Operator", x: 325, max: 12 },
        { label: "Payment", x: 400, max: 10 },
        { label: "Total", x: 540, max: 16, right: true },
      ],
      () => [
        reportHeader(report.settings.storeName, periodLabel),
        sectionTitle("Transaksi Terakhir", 112),
      ],
    );
  }

  if (report.lowStockProducts.length > 0) {
    if (y > 610) {
      pages.push([
        reportHeader(report.settings.storeName, periodLabel),
        sectionTitle("Stok Rendah", 112),
        tableHeader(132, [
          { label: "Produk", x: 52, width: 210 },
          { label: "SKU", x: 280, width: 100 },
          { label: "Stok", x: 470, width: 60 },
        ]),
      ]);
      y = 158;
    } else {
      y += 36;
      pages[pages.length - 1].push(
        sectionTitle("Stok Rendah", y),
        tableHeader(y + 20, [
          { label: "Produk", x: 52, width: 210 },
          { label: "SKU", x: 280, width: 100 },
          { label: "Stok", x: 470, width: 60 },
        ]),
      );
      y += 46;
    }

    addRows(
      pages,
      { get value() { return y; }, set value(next) { y = next; } },
      report.lowStockProducts.map((product) => [
        product.name,
        product.sku ?? "-",
        String(product.stock),
      ]),
      [
        { label: "Produk", x: 52, max: 28 },
        { label: "SKU", x: 280, max: 18 },
        { label: "Stok", x: 505, max: 8, right: true },
      ],
      () => [
        reportHeader(report.settings.storeName, periodLabel),
        sectionTitle("Stok Rendah", 112),
      ],
    );
  }

  const finalPages = pages.map((page, index) =>
    [...page, pageFooter(index + 1, pages.length)].join("\n"),
  );

  const filename = `owner-report-${filenameDate}.pdf`;

  return new NextResponse(new Uint8Array(buildPdfPages(finalPages)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
