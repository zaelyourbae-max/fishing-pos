import { requireCashier } from "@/lib/auth-session";
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
  const auth = await requireCashier(request);

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
  sheet.columns = STOCK_OPNAME_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 6, 18),
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
      rackLocation: item.rackLocationSnapshot ?? "",
      unit: item.unitSnapshot ?? "",
      systemStock: item.systemStock,
      physicalStock: item.physicalStock ?? "",
      notes: item.notes ?? "",
    })),
  );

  for (const row of sheet.getRows(2, session.items.length) ?? []) {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
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
    { header: "Kolom", key: "column", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Aturan", key: "rules", width: 74 },
  ];
  guideSheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
  });
  guideSheet.addRows([
    {
      column: "physicalStock",
      status: "WAJIB",
      rules: "Isi stok fisik hasil hitung. Harus angka bulat >= 0.",
    },
    {
      column: "notes",
      status: "OPSIONAL",
      rules: "Catatan counting atau koreksi.",
    },
    {
      column: "Kolom lain",
      status: "JANGAN UBAH",
      rules: "sessionNumber, itemId, productId, sku, dan systemStock dipakai untuk validasi.",
    },
    {
      column: "Formula Excel",
      status: "DILARANG",
      rules: "Jangan gunakan formula. Gunakan nilai final biasa.",
    },
  ]);
  guideSheet.views = [{ state: "frozen", ySplit: 1 }];

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
