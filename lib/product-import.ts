import { prisma } from "@/lib/prisma";

export const PRODUCT_IMPORT_HEADERS = [
  "sku",
  "barcode",
  "name",
  "category",
  "brand",
  "type",
  "size",
  "variant",
  "supplier",
  "rackLocation",
  "unit",
  "costPrice",
  "sellPrice",
  "stock",
  "minStock",
  "notes",
] as const;

// Kolom yang TIDAK ditampilkan di template unduhan & panduan. Tetap didukung
// sistem (kolom DB & template lama yang masih memuatnya tetap bisa diimpor),
// hanya tidak ikut dicetak di template baru.
export const PRODUCT_IMPORT_HIDDEN_TEMPLATE_HEADERS = [
  "type",
  "size",
  "rackLocation",
] as const;

// Kolom yang dicetak di template unduhan (tanpa type/size/rackLocation).
export const PRODUCT_IMPORT_TEMPLATE_HEADERS = PRODUCT_IMPORT_HEADERS.filter(
  (header) =>
    !(PRODUCT_IMPORT_HIDDEN_TEMPLATE_HEADERS as readonly string[]).includes(
      header,
    ),
);

export const PRODUCT_IMPORT_MAX_ROWS = 5000;
export const PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type ProductImportInput = {
  sku?: unknown;
  barcode?: unknown;
  name?: unknown;
  category?: unknown;
  brand?: unknown;
  type?: unknown;
  size?: unknown;
  variant?: unknown;
  supplier?: unknown;
  rackLocation?: unknown;
  unit?: unknown;
  costPrice?: unknown;
  sellPrice?: unknown;
  stock?: unknown;
  minStock?: unknown;
  notes?: unknown;
};

export type ProductImportNormalizedRow = {
  rowNumber: number;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  type: string;
  size: string;
  variant: string;
  supplier: string;
  rackLocation: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  notes: string;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  willUpdate: boolean;
};

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }

  return String(value).trim();
}

function parseMoney(value: unknown, defaultValue: number | null) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const raw = normalizeText(value);
  if (!raw) {
    return defaultValue;
  }

  const normalized = raw.replace(/[^\d-]/g, "");
  if (!normalized || normalized === "-") {
    return Number.NaN;
  }

  return Number(normalized);
}

function parseInteger(value: unknown, defaultValue: number) {
  const parsed = parseMoney(value, defaultValue);

  if (parsed === null || !Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return Math.trunc(parsed);
}

export function normalizeImportRow(
  input: ProductImportInput,
  rowNumber: number,
): Omit<ProductImportNormalizedRow, "status" | "warnings" | "willUpdate"> {
  const sku = normalizeText(input.sku).toUpperCase();
  const barcode = normalizeText(input.barcode).toUpperCase();
  const name = normalizeText(input.name);
  const category = normalizeText(input.category);
  const brand = normalizeText(input.brand);
  const type = normalizeText(input.type);
  const size = normalizeText(input.size);
  const variant = normalizeText(input.variant);
  const supplier = normalizeText(input.supplier);
  const rackLocation = normalizeText(input.rackLocation);
  const unit = normalizeText(input.unit);
  const notes = normalizeText(input.notes);
  const costPrice = parseMoney(input.costPrice, null);
  const sellPrice = parseMoney(input.sellPrice, null);
  const stock = parseInteger(input.stock, Number.NaN);
  const minStock = parseInteger(input.minStock, Number.NaN);
  const errors: string[] = [];

  if (!name) {
    errors.push("[name] Nama produk wajib diisi");
  }

  if (!category) {
    errors.push("[category] Kategori wajib diisi");
  }

  if (!unit) {
    errors.push("[unit] Satuan utama wajib diisi");
  }

  if (sellPrice === null || !Number.isFinite(sellPrice)) {
    errors.push("[sellPrice] Harga jual harus angka");
  } else if (sellPrice < 0) {
    errors.push("[sellPrice] Harga jual harus >= 0");
  }

  if (costPrice === null || !Number.isFinite(costPrice)) {
    errors.push("[costPrice] Harga modal/HPP harus angka");
  } else if (costPrice < 0) {
    errors.push("[costPrice] Harga modal/HPP harus >= 0");
  }

  if (!Number.isInteger(stock)) {
    errors.push("[stock] Stok harus angka bulat");
  } else if (stock < 0) {
    errors.push("[stock] Stok tidak boleh negatif");
  }

  if (!Number.isInteger(minStock)) {
    errors.push("[minStock] Min stok harus angka bulat");
  } else if (minStock < 0) {
    errors.push("[minStock] Min stok tidak boleh negatif");
  }

  return {
    rowNumber,
    sku,
    barcode,
    name,
    category,
    brand,
    type,
    size,
    variant,
    supplier,
    rackLocation,
    unit,
    costPrice: costPrice ?? 0,
    sellPrice: sellPrice ?? 0,
    stock,
    minStock,
    notes,
    errors,
  };
}

export async function buildProductImportPreview(rows: ProductImportInput[]) {
  if (rows.length === 0) {
    throw new Error("EMPTY_FILE");
  }

  if (rows.length > PRODUCT_IMPORT_MAX_ROWS) {
    throw new Error("TOO_MANY_ROWS");
  }

  const normalized = rows.map((row, index) => normalizeImportRow(row, index + 2));
  const skuCounts = new Map<string, number>();
  const barcodeCounts = new Map<string, number>();

  for (const row of normalized) {
    if (row.sku) {
      skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
    }

    if (row.barcode) {
      barcodeCounts.set(row.barcode, (barcodeCounts.get(row.barcode) ?? 0) + 1);
    }
  }

  for (const row of normalized) {
    if (row.sku && (skuCounts.get(row.sku) ?? 0) > 1) {
      row.errors.push("[sku] SKU duplikat di file");
    }

    if (row.barcode && (barcodeCounts.get(row.barcode) ?? 0) > 1) {
      row.errors.push("[barcode] Barcode duplikat di file");
    }
  }

  const skus = [...new Set(normalized.map((row) => row.sku).filter(Boolean))];
  const barcodes = [
    ...new Set(normalized.map((row) => row.barcode).filter(Boolean)),
  ];
  const supplierNames = [
    ...new Set(normalized.map((row) => row.supplier).filter(Boolean)),
  ];
  const categories = [
    ...new Set(normalized.map((row) => row.category).filter(Boolean)),
  ];
  const [
    existingProducts,
    existingBarcodeProducts,
    existingSuppliers,
    existingCategories,
  ] =
    await Promise.all([
      skus.length
        ? prisma.product.findMany({
            where: {
              sku: {
                in: skus,
              },
            },
            select: {
              id: true,
              sku: true,
              barcode: true,
              isActive: true,
            },
          })
        : [],
      barcodes.length
        ? prisma.product.findMany({
            where: {
              barcode: {
                in: barcodes,
              },
            },
            select: {
              id: true,
              sku: true,
              barcode: true,
            },
          })
        : [],
      supplierNames.length
        ? prisma.supplier.findMany({
            where: {
              name: {
                in: supplierNames,
                mode: "insensitive",
              },
            },
            select: {
              name: true,
            },
          })
        : [],
      categories.length
        ? prisma.product.findMany({
            where: {
              category: {
                in: categories,
                mode: "insensitive",
              },
            },
            distinct: ["category"],
            select: {
              category: true,
            },
          })
        : [],
    ]);
  const existingSkuMap = new Map<
    string,
    { id: number; barcode: string | null; isActive: boolean }
  >();

  for (const product of existingProducts) {
    if (!product.sku) {
      continue;
    }

    existingSkuMap.set(product.sku.toUpperCase(), {
      id: product.id,
      barcode: product.barcode,
      isActive: product.isActive,
    });
  }

  const existingBarcodeMap = new Map<string, { id: number; sku: string | null }>();

  for (const product of existingBarcodeProducts) {
    if (!product.barcode) {
      continue;
    }

    existingBarcodeMap.set(product.barcode.toUpperCase(), {
      id: product.id,
      sku: product.sku,
    });
  }
  const supplierSet = new Set(
    existingSuppliers.map((supplier) => supplier.name.toLowerCase()),
  );
  const categorySet = new Set(
    existingCategories
      .map((product) => product.category?.toLowerCase())
      .filter(Boolean),
  );

  const preview: ProductImportNormalizedRow[] = normalized.map((row) => {
    const warnings: string[] = [];
    const existingBySku = row.sku ? existingSkuMap.get(row.sku) : undefined;
    const existingByBarcode = row.barcode
      ? existingBarcodeMap.get(row.barcode)
      : undefined;
    const willUpdate = existingBySku !== undefined;

    if (!row.sku) {
      warnings.push("SKU kosong, akan dibuat otomatis");
    } else if (willUpdate && !existingBySku.isActive) {
      warnings.push(
        "SKU ditemukan pada produk inactive, produk akan diaktifkan kembali dan diperbarui.",
      );
    } else if (willUpdate) {
      warnings.push("SKU sudah ada, produk akan diperbarui");
    }

    if (row.barcode && existingByBarcode) {
      if (!existingBySku || existingBySku.id !== existingByBarcode.id) {
        row.errors.push(
          "[barcode] Barcode sudah terdaftar di produk lain di database",
        );
      }
    }

    if (row.sku && row.barcode && existingBySku?.barcode) {
      if (existingBySku.barcode.toUpperCase() !== row.barcode) {
        row.errors.push(
          "[sku/barcode] SKU sudah ada dengan barcode yang berbeda di database",
        );
      }
    }

    if (row.supplier && !supplierSet.has(row.supplier.toLowerCase())) {
      warnings.push("Supplier baru akan dibuat");
    }

    if (row.category && !categorySet.has(row.category.toLowerCase())) {
      warnings.push("Kategori baru akan dibuat");
    }

    return {
      ...row,
      warnings,
      willUpdate,
      status:
        row.errors.length > 0
          ? "error"
          : warnings.length > 0
            ? "warning"
            : "valid",
    };
  });
  const summary = {
    totalRows: preview.length,
    validRows: preview.filter((row) => row.status === "valid").length,
    warningRows: preview.filter((row) => row.status === "warning").length,
    errorRows: preview.filter((row) => row.status === "error").length,
  };

  return {
    rows: preview,
    summary,
  };
}

export function supplierCode() {
  return `SUP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

export function buildSkuFromName(name: string, index: number) {
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 14) || "PRODUK";
  const stamp = Date.now().toString(36).toUpperCase();

  return `${slug}-${stamp}-${String(index).padStart(3, "0")}`;
}
