import { requireOwner } from "@/lib/auth-session";
import {
  getStockOpnameDetail,
  STOCK_OPNAME_IMPORT_HEADERS,
} from "@/lib/stock-opname";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const session = await getStockOpnameDetail(params.id);

  if (!session) {
    return NextResponse.json(
      { message: "Sesi Stock Opname tidak ditemukan." },
      { status: 404 },
    );
  }

  if (session.status === "APPROVED" || session.status === "CANCELLED") {
    return NextResponse.json(
      { message: "Template tidak tersedia untuk sesi yang sudah final." },
      { status: 422 },
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fishing POS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("StockOpname");
  // Lebar khusus untuk kolom yang isinya kode panjang agar tidak terpotong/mepet.
  const columnWidthOverrides: Partial<
    Record<(typeof STOCK_OPNAME_IMPORT_HEADERS)[number], number>
  > = {
    sessionNumber: 28,
    sku: 28,
    barcode: 22,
  };

  sheet.columns = STOCK_OPNAME_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: columnWidthOverrides[header] ?? Math.max(header.length + 6, 18),
    // itemId tetap ada (dipakai sistem mencocokkan baris saat import),
    // tapi kolomnya disembunyikan agar tidak mengganggu pandangan owner.
    hidden: header === "itemId",
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  sheet.addRows(
    session.items.map((item) => ({
      sessionNumber: session.opnameNumber,
      itemId: item.id,
      productId: item.productId,
      sku: item.productSkuSnapshot ?? "",
      barcode: item.barcodeSnapshot ?? "",
      name: item.productNameSnapshot,
      category: item.categorySnapshot ?? "",
      unit: item.unitSnapshot ?? "",
      systemStock: item.systemStock,
      physicalStock: item.physicalStock ?? "",
      notes: item.notes ?? "",
    })),
  );

  for (const row of sheet.getRows(2, session.items.length) ?? []) {
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  const guideSheet = workbook.addWorksheet("Panduan");
  guideSheet.columns = [
    { key: "column", width: 30 },
    { key: "status", width: 18 },
    { key: "rules", width: 80 },
  ];

  // Baris judul (gabungan A1:C1)
  guideSheet.mergeCells("A1:C1");
  const guideTitle = guideSheet.getCell("A1");
  guideTitle.value = "PANDUAN PENGISIAN — STOCK OPNAME";
  guideTitle.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  guideTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  guideTitle.alignment = { horizontal: "center", vertical: "middle" };
  guideSheet.getRow(1).height = 32;

  // Baris header tabel
  const guideHeader = guideSheet.addRow({
    column: "Kolom di File",
    status: "Wajib Diisi?",
    rules: "Penjelasan",
  });
  guideHeader.height = 24;
  guideHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const guideRows = [
    {
      column: "physicalStock",
      status: "ISI DI SINI",
      rules:
        "Tulis jumlah stok ASLI hasil hitung fisik di toko/gudang. Wajib angka bulat (0, 1, 2, ...), tidak boleh kosong, tidak boleh minus.",
      fill: "FFDCFCE7",
      statusColor: "FF15803D",
    },
    {
      column: "notes",
      status: "Boleh kosong",
      rules:
        'Catatan tambahan bila perlu, contoh: "barang rusak" atau "ada di rumah". Boleh dikosongkan.',
      fill: "FFF1F5F9",
      statusColor: "FF475569",
    },
    {
      column:
        "Kolom lainnya (sessionNumber, productId, sku, name, systemStock, dll)",
      status: "JANGAN UBAH",
      rules:
        "Sudah terisi otomatis dan dipakai sistem untuk mencocokkan data saat file di-upload kembali. Biarkan apa adanya.",
      fill: "FFFEF3C7",
      statusColor: "FFB45309",
    },
    {
      column: "Rumus Excel",
      status: "DILARANG",
      rules:
        "Jangan memakai rumus Excel (yang diawali tanda =). Ketik nilai angka biasa saja.",
      fill: "FFFEE2E2",
      statusColor: "FFB91C1C",
    },
  ];

  for (const item of guideRows) {
    const row = guideSheet.addRow({
      column: item.column,
      status: item.status,
      rules: item.rules,
    });
    row.height = 42;
    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: item.fill },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (colNumber === 2) {
        cell.font = { bold: true, color: { argb: item.statusColor } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.font = {
          bold: colNumber === 1,
          color: { argb: "FF0F172A" },
        };
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      }
    });
  }

  guideSheet.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${session.opnameNumber}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
