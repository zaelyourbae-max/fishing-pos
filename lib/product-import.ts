import { prisma } from "@/lib/prisma";

export const PRODUCT_IMPORT_HEADERS = [
  "sku",
  "name",
  "category",
  "supplier",
  "costPrice",
  "sellPrice",
  "stock",
  "minStock",
  "unit",
  "notes",
] as const;

export const PRODUCT_IMPORT_MAX_ROWS = 5000;

export type ProductImportInput = {
  sku?: unknown;
  name?: unknown;
  category?: unknown;
  supplier?: unknown;
  costPrice?: unknown;
  sellPrice?: unknown;
  stock?: unknown;
  minStock?: unknown;
  unit?: unknown;
  notes?: unknown;
};

export type ProductImportNormalizedRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string;
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
  const name = normalizeText(input.name);
  const category = normalizeText(input.category);
  const supplier = normalizeText(input.supplier);
  const unit = normalizeText(input.unit) || "pcs";
  const notes = normalizeText(input.notes);
  const costPrice = parseMoney(input.costPrice, 0);
  const sellPrice = parseMoney(input.sellPrice, null);
  const stock = parseInteger(input.stock, 0);
  const minStock = parseInteger(input.minStock, 0);
  const errors: string[] = [];

  if (!name) {
    errors.push("Nama produk wajib diisi");
  }

  if (sellPrice === null || !Number.isFinite(sellPrice)) {
    errors.push("Harga jual harus angka");
  } else if (sellPrice < 0) {
    errors.push("Harga jual harus >= 0");
  }

  if (costPrice === null || !Number.isFinite(costPrice)) {
    errors.push("Harga modal/HPP harus angka");
  } else if (costPrice < 0) {
    errors.push("Harga modal/HPP harus >= 0");
  }

  if (!Number.isInteger(stock)) {
    errors.push("Stok harus angka bulat");
  } else if (stock < 0) {
    errors.push("Stok tidak boleh negatif");
  }

  if (!Number.isInteger(minStock)) {
    errors.push("Min stok harus angka bulat");
  } else if (minStock < 0) {
    errors.push("Min stok tidak boleh negatif");
  }

  return {
    rowNumber,
    sku,
    name,
    category,
    supplier,
    costPrice: costPrice ?? 0,
    sellPrice: sellPrice ?? 0,
    stock,
    minStock,
    unit,
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

  for (const row of normalized) {
    if (row.sku) {
      skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
    }
  }

  for (const row of normalized) {
    if (row.sku && (skuCounts.get(row.sku) ?? 0) > 1) {
      row.errors.push("SKU duplikat di file");
    }
  }

  const skus = [...new Set(normalized.map((row) => row.sku).filter(Boolean))];
  const supplierNames = [
    ...new Set(normalized.map((row) => row.supplier).filter(Boolean)),
  ];
  const categories = [
    ...new Set(normalized.map((row) => row.category).filter(Boolean)),
  ];
  const [existingProducts, existingSuppliers, existingCategories] =
    await Promise.all([
      skus.length
        ? prisma.product.findMany({
            where: {
              sku: {
                in: skus,
              },
            },
            select: {
              sku: true,
              isActive: true,
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
  const existingSkuMap = new Map(
    existingProducts
      .map((product) =>
        product.sku
          ? [product.sku.toUpperCase(), product.isActive] as const
          : null,
      )
      .filter((entry): entry is readonly [string, boolean] => Boolean(entry)),
  );
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
    const existingProductIsActive = row.sku
      ? existingSkuMap.get(row.sku)
      : undefined;
    const willUpdate = existingProductIsActive !== undefined;

    if (!row.sku) {
      warnings.push("SKU kosong, akan dibuat otomatis");
    } else if (willUpdate && existingProductIsActive === false) {
      warnings.push(
        "SKU ditemukan pada produk inactive, produk akan diaktifkan kembali dan diperbarui.",
      );
    } else if (willUpdate) {
      warnings.push("SKU sudah ada, produk akan diperbarui");
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
