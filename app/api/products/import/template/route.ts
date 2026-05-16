import { requireOwner } from "@/lib/auth-session";
import { PRODUCT_IMPORT_HEADERS } from "@/lib/product-import";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const examples = [
  {
    sku: "HOOK-001",
    name: "Kail Carbon No. 3",
    category: "Kail",
    supplier: "Supplier Utama",
    costPrice: 8000,
    sellPrice: 12000,
    stock: 50,
    minStock: 10,
    unit: "pack",
    notes: "Isi 10 pcs",
  },
  {
    sku: "LINE-010",
    name: "Senar Nylon 100m",
    category: "Senar",
    supplier: "Supplier Utama",
    costPrice: 18000,
    sellPrice: 25000,
    stock: 20,
    minStock: 5,
    unit: "roll",
    notes: "Ukuran 0.30 mm",
  },
  {
    sku: "",
    name: "Pelampung Kayu",
    category: "Aksesoris",
    supplier: "",
    costPrice: 3000,
    sellPrice: 5000,
    stock: 30,
    minStock: 8,
    unit: "pcs",
    notes: "SKU otomatis jika kosong",
  },
];

export async function GET(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fishing POS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Products");
  sheet.columns = PRODUCT_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 6, 16),
  }));
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  sheet.addRows(examples);
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of sheet.getRows(2, examples.length) ?? []) {
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

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-produk.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
