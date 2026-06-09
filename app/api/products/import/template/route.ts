import { requireOwner } from "@/lib/auth-session";
import { PRODUCT_IMPORT_TEMPLATE_HEADERS } from "@/lib/product-import";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const examples = [
  {
    sku: "HOOK-001",
    barcode: "899100100001",
    name: "Kail Carbon No. 3",
    category: "Kail",
    brand: "HookMaster",
    type: "Carbon",
    size: "No. 3",
    variant: "Hitam",
    supplier: "Supplier Utama",
    rackLocation: "A-01",
    unit: "pack",
    costPrice: 8000,
    sellPrice: 12000,
    stock: 50,
    minStock: 10,
    notes: "Isi 10 pcs",
  },
  {
    sku: "LINE-010",
    barcode: "899100100002",
    name: "Senar Nylon 100m",
    category: "Senar",
    brand: "RiverLine",
    type: "Nylon",
    size: "0.30 mm",
    variant: "Bening",
    supplier: "Supplier Utama",
    rackLocation: "B-04",
    unit: "roll",
    costPrice: 18000,
    sellPrice: 25000,
    stock: 20,
    minStock: 5,
    notes: "Ukuran 0.30 mm",
  },
  {
    sku: "",
    barcode: "",
    name: "Pelampung Kayu",
    category: "Aksesoris",
    brand: "",
    type: "Pelampung",
    size: "M",
    variant: "",
    supplier: "",
    rackLocation: "C-02",
    unit: "pcs",
    costPrice: 3000,
    sellPrice: 5000,
    stock: 30,
    minStock: 8,
    notes: "SKU otomatis jika kosong",
  },
];

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fishing POS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Products");
  sheet.columns = PRODUCT_IMPORT_TEMPLATE_HEADERS.map((header) => ({
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
  // Sheet Products sengaja dibiarkan kosong (hanya header) agar owner
  // langsung mengisi data produk sendiri mulai dari baris ke-2.
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const guideSheet = workbook.addWorksheet("Panduan");

  // ── Bagian 1: Aturan kolom ─────────────────────────────────────────────
  guideSheet.columns = [
    { header: "Kolom", key: "column", width: 26 },
    { header: "Status", key: "status", width: 14 },
    { header: "Aturan", key: "rules", width: 70 },
  ];
  guideSheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle" };
  });
  guideSheet.addRows([
    { column: "name", status: "WAJIB", rules: "Nama produk wajib diisi." },
    { column: "category", status: "WAJIB", rules: "Kategori/laci wajib diisi." },
    { column: "unit", status: "WAJIB", rules: "Gunakan 1 satuan utama produk, contoh: pcs, meter, gram, kg, pack." },
    { column: "costPrice", status: "WAJIB", rules: "Angka >= 0 (HPP per unit utama)." },
    { column: "sellPrice", status: "WAJIB", rules: "Angka >= 0 (harga jual per unit utama)." },
    { column: "stock", status: "WAJIB", rules: "Angka bulat >= 0." },
    { column: "minStock", status: "WAJIB", rules: "Angka bulat >= 0." },
    { column: "sku", status: "OPSIONAL", rules: "Jika kosong, sistem akan generate SKU otomatis." },
    { column: "barcode", status: "OPSIONAL", rules: "Jika diisi harus unik dan tidak boleh duplikat." },
    { column: "brand/variant", status: "OPSIONAL", rules: "Isi sesuai kebutuhan master data." },
    { column: "supplier", status: "OPSIONAL", rules: "Jika belum ada di database, supplier baru akan dibuat saat commit." },
    { column: "notes", status: "OPSIONAL", rules: "Catatan produk." },
    { column: "Formula Excel", status: "DILARANG", rules: "Jangan gunakan formula. Gunakan nilai final biasa." },
  ]);

  // ── Bagian 2: Contoh data produk ──────────────────────────────────────
  // Baris kosong sebagai pemisah
  guideSheet.addRow([]);

  // Judul bagian contoh
  const exampleTitleRow = guideSheet.addRow(["CONTOH DATA PRODUK"]);
  exampleTitleRow.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  exampleTitleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  exampleTitleRow.getCell(1).alignment = { vertical: "middle" };

  // Header kolom contoh (sama persis dengan sheet Products)
  const exampleHeaderRow = guideSheet.addRow([
    "sku", "barcode", "name", "category", "brand",
    "variant", "supplier", "unit", "costPrice",
    "sellPrice", "stock", "minStock", "notes",
  ]);
  exampleHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF374151" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Baris contoh produk
  const exampleDataRows = [
    [
      "HOOK-001", "899100100001", "Kail Carbon No. 3", "Kail",
      "HookMaster", "Hitam",
      "Supplier Utama", "pack", 8000, 12000, 50, 10,
      "Isi 10 pcs",
    ],
    [
      "LINE-010", "899100100002", "Senar Nylon 100m", "Senar",
      "RiverLine", "Bening",
      "Supplier Utama", "roll", 18000, 25000, 20, 5,
      "Ukuran 0.30 mm",
    ],
    [
      "", "", "Pelampung Kayu", "Aksesoris",
      "", "",
      "", "pcs", 3000, 5000, 30, 8,
      "SKU otomatis jika kosong",
    ],
  ];

  for (const data of exampleDataRows) {
    const dataRow = guideSheet.addRow(data);
    dataRow.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  guideSheet.views = [{ state: "frozen", ySplit: 1 }];

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
