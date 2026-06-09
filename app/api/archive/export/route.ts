import { requireOwner } from "@/lib/auth-session";
import {
  getArchivedSalesForExport,
  markArchivedExported,
} from "@/lib/archive";
import { formatDateTimeID } from "@/lib/date-format";
import { reportDateStamp } from "@/lib/reports";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COLORS = {
  navy: "FF0F172A",
  white: "FFFFFFFF",
  slateBorder: "FFCBD5E1",
  lightBlue: "FFEFF6FF",
};
const CURRENCY_FORMAT = '"Rp" #,##0;-"Rp" #,##0;"Rp" 0';

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function finishSheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.slateBorder } },
        left: { style: "thin", color: { argb: COLORS.slateBorder } },
        bottom: { style: "thin", color: { argb: COLORS.slateBorder } },
        right: { style: "thin", color: { argb: COLORS.slateBorder } },
      };
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle", wrapText: true };
      }
      if (rowNumber > 1 && rowNumber % 2 === 0 && !cell.fill) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.lightBlue },
        };
      }
    });
  });
}

/** TAHAP 2 — POST: buat file Excel arsip, tandai sudah diekspor, kirim file. */
export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const rows = await getArchivedSalesForExport();

  if (rows.length === 0) {
    return NextResponse.json(
      { message: "Belum ada data di arsip untuk diekspor." },
      { status: 422 },
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fishing POS";
  workbook.created = new Date();

  // Sheet 1 — satu baris per transaksi.
  const txSheet = workbook.addWorksheet("Transaksi Arsip");
  txSheet.columns = [
    { header: "Invoice", key: "invoice", width: 26 },
    { header: "Tanggal", key: "date", width: 22 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Operator", key: "cashier", width: 20 },
    { header: "Pembayaran", key: "payment", width: 16 },
    { header: "Status Transaksi", key: "txStatus", width: 18 },
    { header: "Status Bayar", key: "payStatus", width: 16 },
    { header: "Jumlah Item", key: "itemCount", width: 14 },
    { header: "Total", key: "subtotal", width: 18 },
    { header: "Dibayar", key: "paid", width: 18 },
  ];
  styleHeader(txSheet.getRow(1));
  txSheet.addRows(
    rows.map((sale) => ({
      invoice: sale.invoiceNumber,
      date: formatDateTimeID(sale.createdAt),
      customer: sale.customerName,
      cashier: sale.cashierName,
      payment: sale.paymentMethod,
      txStatus: sale.transactionStatus,
      payStatus: sale.paymentStatus,
      itemCount: sale.items.length,
      subtotal: sale.subtotal,
      paid: sale.paidAmount,
    })),
  );
  txSheet.getColumn("subtotal").numFmt = CURRENCY_FORMAT;
  txSheet.getColumn("paid").numFmt = CURRENCY_FORMAT;
  finishSheet(txSheet);

  // Sheet 2 — satu baris per item (rincian lengkap).
  const itemSheet = workbook.addWorksheet("Rincian Item");
  itemSheet.columns = [
    { header: "Invoice", key: "invoice", width: 26 },
    { header: "Tanggal", key: "date", width: 22 },
    { header: "Produk", key: "product", width: 30 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Harga", key: "price", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 18 },
  ];
  styleHeader(itemSheet.getRow(1));
  const itemRows = rows.flatMap((sale) =>
    sale.items.map((item) => ({
      invoice: sale.invoiceNumber,
      date: formatDateTimeID(sale.createdAt),
      product: item.productName,
      sku: item.sku,
      qty: item.qty,
      price: item.price,
      subtotal: item.subtotal,
    })),
  );
  itemSheet.addRows(itemRows);
  itemSheet.getColumn("qty").numFmt = "#,##0";
  itemSheet.getColumn("price").numFmt = CURRENCY_FORMAT;
  itemSheet.getColumn("subtotal").numFmt = CURRENCY_FORMAT;
  finishSheet(itemSheet);

  const buffer = await workbook.xlsx.writeBuffer();

  // Tandai sudah diekspor HANYA setelah file berhasil dibuat → buka kunci hapus.
  await markArchivedExported();

  const filename = `arsip-transaksi-${reportDateStamp()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
