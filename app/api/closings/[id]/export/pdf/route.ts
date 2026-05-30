import { requireOwner } from "@/lib/auth-session";
import { dateInputValue, getDailyClosing } from "@/lib/daily-closing";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
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
const SOFT_AMBER = "#FFFBEB";

type PaymentRow = {
  method: string;
  total: number;
  count: number;
};

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDate(date: Date) {
  return formatDateID(date);
}

function formatDateTime(date?: Date | null) {
  if (!date) {
    return "-";
  }

  return formatDateTimeID(date);
}

function objectValue(value: unknown, key: string) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function parsePaymentSummary(value: unknown): PaymentRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => ({
    method: String(objectValue(item, "method") ?? "-"),
    total: numberValue(objectValue(item, "total")),
    count: numberValue(objectValue(item, "count")),
  }));
}

function paymentMethodLabel(method: string) {
  const normalized = method.toUpperCase();

  if (normalized === "CASH") {
    return "CASH";
  }

  if (normalized === "QRIS") {
    return "QRIS";
  }

  if (normalized === "TRANSFER" || normalized === "BANK_TRANSFER") {
    return "Transfer Bank";
  }

  return method.replaceAll("_", " ");
}

function cashDifferenceStatus(value: number) {
  if (value === 0) {
    return "Sesuai";
  }

  if (value < 0) {
    return "Kurang";
  }

  return "Lebih";
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
    "0.8 w",
    `${x} ${yy} ${width} ${height} re B`,
  ].join("\n");
}

function line(x1: number, y1: number, x2: number, y2: number, stroke = BORDER) {
  return `${color(stroke)} RG\n0.8 w\n${x1} ${PAGE_HEIGHT - y1} m\n${x2} ${
    PAGE_HEIGHT - y2
  } l\nS`;
}

function truncate(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
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
    text(value, x + 44, y + 39, 12, "F2", NAVY),
    helper ? text(helper, x + 44, y + 55, 7.5, "F1", MUTED) : "",
  ].join("\n");
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

function reportHeader(storeName: string, closingDate: Date, status: string) {
  return [
    text(storeName.toUpperCase(), MARGIN_X, 48, 22, "F2", TEAL),
    text("Laporan Closing Harian", MARGIN_X, 72, 13, "F1", "#475569"),
    text("Tanggal closing", 360, 42, 8, "F1", MUTED),
    text(formatDate(closingDate), 360, 58, 9, "F2", NAVY),
    text("Tanggal cetak", 462, 42, 8, "F1", MUTED),
    text(formatDateTime(new Date()), 462, 58, 9, "F2", NAVY),
    text("Status closing", 360, 76, 8, "F1", MUTED),
    text(status, 360, 92, 9, "F2", NAVY),
    line(MARGIN_X, 108, PAGE_WIDTH - MARGIN_X, 108, "#99D6CB"),
  ].join("\n");
}

function sectionTitle(label: string, y: number) {
  return text(label.toUpperCase(), MARGIN_X, y, 11, "F2", NAVY);
}

export async function GET(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const closing = await prisma.dailyClosing.findUnique({
    where: {
      id,
    },
    select: {
      closingDate: true,
    },
  });

  if (!closing) {
    return NextResponse.json(
      { message: "Closing tidak ditemukan." },
      { status: 404 },
    );
  }

  const [settings, fullClosing] = await Promise.all([
    getSettings(),
    getDailyClosing(prisma, closing.closingDate),
  ]);

  if (!fullClosing) {
    return NextResponse.json(
      { message: "Closing tidak ditemukan." },
      { status: 404 },
    );
  }

  const paymentRows = parsePaymentSummary(fullClosing.paymentSummary);
  const pages: string[][] = [[
    reportHeader(settings.storeName, fullClosing.closingDate, fullClosing.status),
  ]];
  let y = 136;

  pages[0].push(
    sectionTitle("Ringkasan Closing", y),
    metricCard(40, 148, 160, "Expected Cash", formatRupiah(fullClosing.expectedCash)),
    metricCard(218, 148, 150, "Cash Aktual", formatRupiah(fullClosing.actualCash)),
    metricCard(
      386,
      148,
      169,
      "Selisih",
      formatRupiah(fullClosing.difference),
      cashDifferenceStatus(fullClosing.difference),
      fullClosing.difference === 0 ? SOFT_TEAL : SOFT_AMBER,
    ),
    metricCard(40, 226, 160, "Omzet Kotor", formatRupiah(fullClosing.grossOmzet)),
    metricCard(218, 226, 150, "Omzet Bersih", formatRupiah(fullClosing.netOmzet)),
    metricCard(
          386,
          226,
          169,
          "Transaksi",
          String(fullClosing.transactionCount),
      `Status ${fullClosing.status}`,
      SOFT_BLUE,
    ),
    sectionTitle("Detail Status", 320),
    tableRow(342, [
      { value: "Status", x: 52, max: 24 },
      { value: fullClosing.status, x: 210, max: 34 },
      { value: "Waktu closing", x: 330, max: 24 },
      { value: formatDateTime(fullClosing.closedAt), x: 440, max: 28 },
    ]),
    tableRow(370, [
      { value: "Closed by", x: 52, max: 24 },
      { value: fullClosing.closedBy?.name ?? "-", x: 210, max: 34 },
      { value: "Nilai retur", x: 330, max: 24 },
      { value: formatRupiah(fullClosing.returnValue), x: 540, max: 18, right: true },
    ]),
  );

  y = 422;
  pages[0].push(
    sectionTitle("Ringkasan Pembayaran", y),
    tableHeader(y + 20, [
      { label: "Metode", x: 52, width: 150 },
      { label: "Transaksi", x: 260, width: 90 },
      { label: "Total", x: 430, width: 100 },
    ]),
  );
  y += 46;

  if (paymentRows.length === 0) {
    pages[0].push(tableRow(y, [{ value: "Belum ada pembayaran", x: 52, max: 60 }]));
    y += 28;
  } else {
    for (const payment of paymentRows) {
      pages[0].push(
        tableRow(y, [
          { value: paymentMethodLabel(payment.method), x: 52, max: 24 },
          { value: String(payment.count), x: 260, max: 12 },
          { value: formatRupiah(payment.total), x: 540, max: 18, right: true },
        ]),
      );
      y += 28;
    }
  }

  y += 34;
  pages[0].push(sectionTitle("Catatan Closing", y));
  y += 22;
  pages[0].push(
    tableRow(y, [{ value: fullClosing.notes || "-", x: 52, max: 80 }]),
  );
  y += 58;

  if (fullClosing.reopenedAt) {
    pages[0].push(sectionTitle("Reopen Terakhir", y));
    y += 22;
    pages[0].push(
      tableRow(y, [
        { value: "Reopened at", x: 52, max: 18 },
        { value: formatDateTime(fullClosing.reopenedAt), x: 180, max: 28 },
        { value: "By", x: 350, max: 8 },
        { value: fullClosing.reopenedBy?.name ?? "-", x: 390, max: 22 },
      ]),
      tableRow(y + 28, [
        { value: "Reason", x: 52, max: 18 },
        { value: fullClosing.reopenReason ?? "-", x: 180, max: 58 },
      ]),
    );
    y += 70;
  }

  if (y > 650) {
    pages.push([
      reportHeader(settings.storeName, fullClosing.closingDate, fullClosing.status),
    ]);
    y = 126;
  }

  pages[pages.length - 1].push(
    sectionTitle("Audit Log Closing", y),
    tableHeader(y + 20, [
      { label: "Action", x: 52, width: 80 },
      { label: "User", x: 132, width: 130 },
      { label: "Waktu", x: 260, width: 130 },
      { label: "Alasan/Catatan", x: 390, width: 140 },
    ]),
  );
  y += 46;

  if (fullClosing.logs.length === 0) {
    pages[pages.length - 1].push(
      tableRow(y, [{ value: "Belum ada audit log", x: 52, max: 60 }]),
    );
  } else {
    for (const log of fullClosing.logs) {
      if (y > 738) {
        pages.push([
          reportHeader(settings.storeName, fullClosing.closingDate, fullClosing.status),
          sectionTitle("Audit Log Closing", 112),
          tableHeader(132, [
            { label: "Action", x: 52, width: 80 },
            { label: "User", x: 132, width: 130 },
            { label: "Waktu", x: 260, width: 130 },
            { label: "Alasan/Catatan", x: 390, width: 140 },
          ]),
        ]);
        y = 158;
      }

      pages[pages.length - 1].push(
        tableRow(y, [
          { value: log.action, x: 52, max: 12 },
          { value: log.user?.name ?? "-", x: 132, max: 20 },
          { value: formatDateTime(log.createdAt), x: 260, max: 22 },
          { value: log.reason ?? log.note ?? "-", x: 390, max: 30 },
        ]),
      );
      y += 28;
    }
  }

  const finalPages = pages.map((page, index) =>
    [...page, pageFooter(index + 1, pages.length)].join("\n"),
  );
  const filename = `closing-${dateInputValue(fullClosing.closingDate)}.pdf`;

  return new NextResponse(new Uint8Array(buildPdfPages(finalPages)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
