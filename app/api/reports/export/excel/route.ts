import { requireOwner } from "@/lib/auth-session";
import { formatDateTimeID } from "@/lib/date-format";
import {
  getOwnerReportReturns,
  getOwnerReportSummary,
  getOwnerReportTransactions,
  reportDateStamp,
} from "@/lib/reports";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { operatorLabel } from "@/lib/transaction-identity";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COLORS = {
  navy: "FF0F172A",
  white: "FFFFFFFF",
  slateBorder: "FFCBD5E1",
  slateText: "FF334155",
  lightBlue: "FFEFF6FF",
  lightSlate: "FFF8FAFC",
};
const CURRENCY_FORMAT = '"Rp" #,##0;-"Rp" #,##0;"Rp" 0';

function reasonLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function setCellStyle(
  cell: ExcelJS.Cell,
  options: {
    bold?: boolean;
    color?: string;
    fill?: string;
    fontSize?: number;
    align?: Partial<ExcelJS.Alignment>;
  } = {},
) {
  cell.font = {
    bold: options.bold ?? false,
    color: { argb: options.color ?? COLORS.slateText },
    size: options.fontSize ?? 11,
  };
  cell.alignment = {
    vertical: "middle",
    wrapText: true,
    ...options.align,
  };

  if (options.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options.fill },
    };
  }
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    setCellStyle(cell, {
      bold: true,
      color: COLORS.white,
      fill: COLORS.navy,
      align: { horizontal: "center" },
    });
  });
}

function applyTableBorder(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.slateBorder } },
        left: { style: "thin", color: { argb: COLORS.slateBorder } },
        bottom: { style: "thin", color: { argb: COLORS.slateBorder } },
        right: { style: "thin", color: { argb: COLORS.slateBorder } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12, maxWidth = 38) {
  worksheet.columns.forEach((column) => {
    let width = minWidth;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text =
        value instanceof Date
          ? formatDateTime(value)
          : typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value ?? "");

      width = Math.max(width, Math.min(maxWidth, text.length + 3));
    });

    column.width = width;
  });
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.properties.defaultRowHeight = 22;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  applyTableBorder(worksheet);
  autoFitColumns(worksheet);
}

function addSummaryRow(
  worksheet: ExcelJS.Worksheet,
  label: string,
  value: string | number | Date,
  format?: string,
) {
  const row = worksheet.addRow([label, value]);
  setCellStyle(row.getCell(1), {
    bold: true,
    fill: COLORS.lightSlate,
  });

  if (typeof value === "number") {
    row.getCell(2).numFmt = format ?? "#,##0";
  }
  if (value instanceof Date) {
    row.getCell(2).numFmt = "dd mmm yyyy hh:mm";
  }
}

function addEmptyState(worksheet: ExcelJS.Worksheet, columnCount: number) {
  const row = worksheet.addRow(["Belum ada data"]);
  worksheet.mergeCells(row.number, 1, row.number, columnCount);
  setCellStyle(row.getCell(1), {
    color: "FF64748B",
    fill: COLORS.lightSlate,
    align: { horizontal: "center" },
  });
}

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const [report, transactions, returns] = await Promise.all([
    getOwnerReportSummary(),
    // Minta sampai 5000 baris supaya daftar transaksi & retur di file Excel
    // tidak terpotong di bulan ramai (sebelumnya default 200).
    getOwnerReportTransactions(5000),
    getOwnerReportReturns(5000),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fishing POS";
  workbook.lastModifiedBy = "Fishing POS";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = workbook.addWorksheet("Ringkasan");
  summary.columns = [
    { header: "Item", key: "item", width: 34 },
    { header: "Nilai", key: "value", width: 32 },
  ];
  styleHeader(summary.getRow(1));
  addSummaryRow(summary, "Nama toko", report.settings.storeName);
  addSummaryRow(summary, "Tanggal cetak", new Date());
  addSummaryRow(summary, "Omzet kotor hari ini", report.today.grossOmzet, CURRENCY_FORMAT);
  addSummaryRow(summary, "Nilai retur hari ini", report.today.returnValue, CURRENCY_FORMAT);
  addSummaryRow(summary, "Omzet bersih hari ini", report.today.netOmzet, CURRENCY_FORMAT);
  addSummaryRow(summary, "Omzet kotor bulan ini", report.month.grossOmzet, CURRENCY_FORMAT);
  addSummaryRow(summary, "Nilai retur bulan ini", report.month.returnValue, CURRENCY_FORMAT);
  addSummaryRow(summary, "Omzet bersih bulan ini", report.month.netOmzet, CURRENCY_FORMAT);
  addSummaryRow(summary, "Jumlah transaksi hari ini", report.today.transactions);
  addSummaryRow(summary, "Jumlah transaksi bulan ini", report.month.transactions);
  addSummaryRow(summary, "Total retur hari ini", report.today.returnCount);
  addSummaryRow(summary, "Total retur bulan ini", report.month.returnCount);
  addSummaryRow(
    summary,
    "Average transaction value hari ini",
    report.today.averageTransaction,
    CURRENCY_FORMAT,
  );
  addSummaryRow(
    summary,
    "Average transaction value bulan ini",
    report.month.averageTransaction,
    CURRENCY_FORMAT,
  );
  summary.getColumn(2).alignment = { horizontal: "left", vertical: "middle" };
  styleWorksheet(summary);

  const payment = workbook.addWorksheet("Payment Summary");
  payment.columns = [
    { header: "Periode", key: "period", width: 18 },
    { header: "Payment Method", key: "method", width: 22 },
    { header: "Jumlah Transaksi", key: "transactions", width: 18 },
    { header: "Total Omzet", key: "total", width: 24 },
  ];
  styleHeader(payment.getRow(1));
  const paymentRows = [
    ...report.today.paymentSummary.map((item) => ({
      period: "Hari Ini",
      method: item.paymentLabel,
      transactions: item.transactions,
      total: item.total,
    })),
    ...report.month.paymentSummary.map((item) => ({
      period: "Bulan Ini",
      method: item.paymentLabel,
      transactions: item.transactions,
      total: item.total,
    })),
  ];
  if (paymentRows.length > 0) {
    payment.addRows(paymentRows);
  } else {
    addEmptyState(payment, 4);
  }
  payment.getColumn("total").numFmt = CURRENCY_FORMAT;
  styleWorksheet(payment);

  const transactionSheet = workbook.addWorksheet("Transaksi");
  transactionSheet.columns = [
    { header: "Invoice", key: "invoice", width: 26 },
    { header: "Tanggal", key: "date", width: 24 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Operator", key: "cashier", width: 26 },
    { header: "Payment Method", key: "payment", width: 18 },
    { header: "Total", key: "total", width: 20 },
  ];
  styleHeader(transactionSheet.getRow(1));
  if (transactions.length > 0) {
    transactionSheet.addRows(
      transactions.map((sale) => ({
        invoice: sale.invoiceNumber,
        date: sale.createdAt,
        customer: sale.customer?.name ?? "Walk-in",
        cashier: operatorLabel(sale.cashier),
        payment: sale.paymentLabel,
        total: sale.subtotal,
      })),
    );
  } else {
    addEmptyState(transactionSheet, 6);
  }
  transactionSheet.getColumn("date").numFmt = "dd mmm yyyy hh:mm";
  transactionSheet.getColumn("total").numFmt = CURRENCY_FORMAT;
  styleWorksheet(transactionSheet);

  const bestSellerSheet = workbook.addWorksheet("Produk Terlaris");
  bestSellerSheet.columns = [
    { header: "Nama Produk", key: "name", width: 30 },
    { header: "Qty Terjual", key: "qty", width: 16 },
    { header: "Omzet", key: "total", width: 20 },
  ];
  styleHeader(bestSellerSheet.getRow(1));
  if (report.bestSellers.length > 0) {
    bestSellerSheet.addRows(
      report.bestSellers.map((item) => ({
        name: item.name,
        qty: item.qty,
        total: item.total,
      })),
    );
  } else {
    addEmptyState(bestSellerSheet, 3);
  }
  bestSellerSheet.getColumn("qty").numFmt = "#,##0";
  bestSellerSheet.getColumn("total").numFmt = CURRENCY_FORMAT;
  styleWorksheet(bestSellerSheet);

  const lowStockSheet = workbook.addWorksheet("Stok Rendah");
  lowStockSheet.columns = [
    { header: "SKU", key: "sku", width: 20 },
    { header: "Nama Produk", key: "name", width: 32 },
    { header: "Stok Sekarang", key: "stock", width: 16 },
  ];
  styleHeader(lowStockSheet.getRow(1));
  if (report.lowStockProducts.length > 0) {
    lowStockSheet.addRows(
      report.lowStockProducts.map((product) => ({
        sku: product.sku ?? "-",
        name: product.name,
        stock: product.stock,
      })),
    );
  } else {
    addEmptyState(lowStockSheet, 3);
  }
  lowStockSheet.getColumn("stock").numFmt = "#,##0";
  styleWorksheet(lowStockSheet);

  const returnSheet = workbook.addWorksheet("Retur");
  returnSheet.columns = [
    { header: "Tanggal", key: "date", width: 24 },
    { header: "Invoice", key: "invoice", width: 24 },
    { header: "Produk", key: "product", width: 30 },
    { header: "Qty", key: "qty", width: 12 },
    { header: "Nilai Retur", key: "subtotal", width: 20 },
    { header: "Alasan", key: "reason", width: 22 },
    { header: "Catatan", key: "notes", width: 30 },
    { header: "Operator", key: "cashier", width: 26 },
  ];
  styleHeader(returnSheet.getRow(1));
  const returnRows = returns.flatMap((saleReturn) =>
    saleReturn.items.map((item) => ({
      date: saleReturn.createdAt,
      invoice: saleReturn.sale.invoiceNumber,
      product: item.product.name,
      qty: item.qty,
      subtotal: item.subtotal,
      reason: reasonLabel(saleReturn.reason),
      notes: saleReturn.notes ?? "-",
      cashier: operatorLabel(saleReturn.sale.cashier),
    })),
  );
  if (returnRows.length > 0) {
    returnSheet.addRows(returnRows);
  } else {
    addEmptyState(returnSheet, 8);
  }
  returnSheet.getColumn("date").numFmt = "dd mmm yyyy hh:mm";
  returnSheet.getColumn("qty").numFmt = "#,##0";
  returnSheet.getColumn("subtotal").numFmt = CURRENCY_FORMAT;
  styleWorksheet(returnSheet);

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          if (!cell.fill) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: COLORS.lightBlue },
            };
          }
        });
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `owner-report-${reportDateStamp()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
