import {
  Prisma,
  StockOpnameMode,
  StockOpnameStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const STOCK_OPNAME_IMPORT_HEADERS = [
  "sessionNumber",
  "itemId",
  "productId",
  "sku",
  "barcode",
  "name",
  "category",
  "rackLocation",
  "unit",
  "systemStock",
  "physicalStock",
  "notes",
] as const;

export const STOCK_OPNAME_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const STOCK_OPNAME_MAX_ROWS = 10000;
export const STOCK_OPNAME_MOVEMENT_TYPE = "STOCK_OPNAME_ADJUSTMENT";

export type StockOpnameImportInput = Partial<
  Record<(typeof STOCK_OPNAME_IMPORT_HEADERS)[number], unknown>
>;

export type StockOpnameValidatedImportRow = {
  rowNumber: number;
  sessionNumber: string;
  itemId: string;
  productId: number | null;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  rackLocation: string;
  unit: string;
  systemStock: number | null;
  physicalStock: number | null;
  notes: string;
  difference: number | null;
  status: "valid" | "error";
  errors: string[];
};

export class StockOpnameError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

function readText(value: unknown) {
  return String(value ?? "").trim();
}

function readUpperText(value: unknown) {
  return readText(value).toUpperCase();
}

function parseInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  const raw = readText(value).replace(/[^\d-]/g, "");
  if (!raw || raw === "-") {
    return Number.NaN;
  }

  const number = Number(raw);
  return Number.isInteger(number) ? number : Number.NaN;
}

export function parsePhysicalStock(value: unknown) {
  const physicalStock = parseInteger(value);

  if (
    physicalStock === null ||
    !Number.isInteger(physicalStock) ||
    physicalStock < 0
  ) {
    return null;
  }

  return physicalStock;
}

export function stockOpnameNumber() {
  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "")
    .slice(0, 14);

  return `SO-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function statusLabel(status: StockOpnameStatus) {
  const labels: Record<StockOpnameStatus, string> = {
    DRAFT: "Draft",
    COUNTING: "Counting",
    REVIEW: "Review",
    APPROVED: "Approved",
    CANCELLED: "Cancelled",
  };

  return labels[status];
}

export function stockOpnameProgress(items: Array<{ physicalStock: number | null }>) {
  const counted = items.filter((item) => item.physicalStock !== null).length;

  return {
    total: items.length,
    counted,
    remaining: items.length - counted,
  };
}

export async function createStockOpnameSession(input: {
  userId: number;
  title?: string;
  notes?: string;
}) {
  const title = readText(input.title);
  const notes = readText(input.notes);

  return prisma.$transaction(
    async (tx) => {
      const products = await tx.product.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          sku: true,
          barcode: true,
          name: true,
          category: true,
          unit: true,
          rackLocation: true,
          stock: true,
        },
      });

      if (products.length === 0) {
        throw new StockOpnameError("NO_PRODUCTS");
      }

      const session = await tx.stockOpnameSession.create({
        data: {
          opnameNumber: stockOpnameNumber(),
          mode: StockOpnameMode.IMPORT_EXCEL,
          status: StockOpnameStatus.COUNTING,
          title: title || null,
          notes: notes || null,
          createdById: input.userId,
        },
        select: {
          id: true,
          opnameNumber: true,
          status: true,
        },
      });

      await tx.stockOpnameItem.createMany({
        data: products.map((product) => ({
          sessionId: session.id,
          productId: product.id,
          productSkuSnapshot: product.sku,
          barcodeSnapshot: product.barcode,
          productNameSnapshot: product.name,
          categorySnapshot: product.category,
          unitSnapshot: product.unit,
          rackLocationSnapshot: product.rackLocation,
          systemStock: product.stock,
          source: null,
        })),
      });

      return {
        ...session,
        totalItems: products.length,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function getStockOpnameList() {
  return prisma.stockOpnameSession.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      createdBy: {
        select: {
          name: true,
          role: {
            select: {
              slug: true,
            },
          },
        },
      },
      approvedBy: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
      items: {
        select: {
          physicalStock: true,
          difference: true,
        },
      },
    },
  });
}

export async function getStockOpnameDetail(id: string) {
  return prisma.stockOpnameSession.findUnique({
    where: {
      id,
    },
    include: {
      createdBy: {
        select: {
          name: true,
          role: {
            select: {
              slug: true,
            },
          },
        },
      },
      approvedBy: {
        select: {
          name: true,
        },
      },
      cancelledBy: {
        select: {
          name: true,
        },
      },
      items: {
        orderBy: [
          {
            productNameSnapshot: "asc",
          },
          {
            id: "asc",
          },
        ],
      },
    },
  });
}

export async function validateStockOpnameImportRows(input: {
  sessionId: string;
  rows: StockOpnameImportInput[];
}) {
  if (input.rows.length === 0) {
    throw new StockOpnameError("EMPTY_FILE");
  }

  if (input.rows.length > STOCK_OPNAME_MAX_ROWS) {
    throw new StockOpnameError("TOO_MANY_ROWS");
  }

  const session = await prisma.stockOpnameSession.findUnique({
    where: {
      id: input.sessionId,
    },
    include: {
      items: true,
    },
  });

  if (!session) {
    throw new StockOpnameError("SESSION_NOT_FOUND");
  }

  if (session.status !== StockOpnameStatus.COUNTING) {
    throw new StockOpnameError("SESSION_NOT_COUNTING");
  }

  const itemById = new Map(session.items.map((item) => [item.id, item]));
  const seenItemIds = new Set<string>();
  const seenProductIds = new Set<number>();
  const seenSkus = new Set<string>();

  const rows: StockOpnameValidatedImportRow[] = input.rows.map(
    (row, index) => {
      const sessionNumber = readText(row.sessionNumber);
      const itemId = readText(row.itemId);
      const productId = parseInteger(row.productId);
      const sku = readUpperText(row.sku);
      const barcode = readUpperText(row.barcode);
      const name = readText(row.name);
      const category = readText(row.category);
      const rackLocation = readText(row.rackLocation);
      const unit = readText(row.unit);
      const systemStock = parseInteger(row.systemStock);
      const physicalStock = parseInteger(row.physicalStock);
      const notes = readText(row.notes);
      const errors: string[] = [];
      const item = itemById.get(itemId);
      const validPhysicalStock =
        typeof physicalStock === "number" && Number.isInteger(physicalStock)
          ? physicalStock
          : null;

      if (sessionNumber !== session.opnameNumber) {
        errors.push("[sessionNumber] Nomor sesi tidak cocok");
      }

      if (!item) {
        errors.push("[itemId] Item tidak ditemukan di sesi SO");
      }

      if (!Number.isInteger(productId) || productId === null || productId <= 0) {
        errors.push("[productId] Product ID tidak valid");
      } else {
        if (seenProductIds.has(productId)) {
          errors.push("[productId] Product ID duplikat di file");
        }
        seenProductIds.add(productId);
      }

      if (itemId) {
        if (seenItemIds.has(itemId)) {
          errors.push("[itemId] Item ID duplikat di file");
        }
        seenItemIds.add(itemId);
      }

      if (sku) {
        if (seenSkus.has(sku)) {
          errors.push("[sku] SKU duplikat di file");
        }
        seenSkus.add(sku);
      }

      if (item && productId !== item.productId) {
        errors.push("[productId] Product ID tidak cocok dengan item");
      }

      if (
        item &&
        sku &&
        item.productSkuSnapshot &&
        sku !== item.productSkuSnapshot.toUpperCase()
      ) {
        errors.push("[sku] SKU tidak cocok dengan snapshot");
      }

      if (item && Number.isInteger(systemStock) && systemStock !== item.systemStock) {
        errors.push("[systemStock] Stok sistem tidak cocok dengan snapshot");
      }

      if (validPhysicalStock === null) {
        errors.push("[physicalStock] Stok fisik wajib angka bulat");
      } else if (validPhysicalStock < 0) {
        errors.push("[physicalStock] Stok fisik tidak boleh negatif");
      }

      return {
        rowNumber: index + 2,
        sessionNumber,
        itemId,
        productId: Number.isInteger(productId) ? productId : null,
        sku,
        barcode,
        name,
        category,
        rackLocation,
        unit,
        systemStock: Number.isInteger(systemStock) ? systemStock : null,
        physicalStock: validPhysicalStock,
        notes,
        difference:
          item && validPhysicalStock !== null
            ? validPhysicalStock - item.systemStock
            : null,
        status: errors.length > 0 ? "error" : "valid",
        errors,
      };
    },
  );

  const errorRows = rows.filter((row) => row.status === "error").length;

  return {
    session: {
      id: session.id,
      opnameNumber: session.opnameNumber,
      status: session.status,
    },
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      errorRows,
    },
  };
}

export async function applyStockOpnameImportRows(input: {
  sessionId: string;
  rows: StockOpnameImportInput[];
  userId: number;
}) {
  const preview = await validateStockOpnameImportRows({
    sessionId: input.sessionId,
    rows: input.rows,
  });

  if (preview.summary.errorRows > 0) {
    throw new StockOpnameError("IMPORT_HAS_ERRORS", preview);
  }

  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const session = await tx.stockOpnameSession.findUnique({
        where: {
          id: input.sessionId,
        },
        select: {
          status: true,
        },
      });

      if (!session) {
        throw new StockOpnameError("SESSION_NOT_FOUND");
      }

      if (session.status !== StockOpnameStatus.COUNTING) {
        throw new StockOpnameError("SESSION_NOT_COUNTING");
      }

      for (const row of preview.rows) {
        if (row.physicalStock === null) {
          throw new StockOpnameError("IMPORT_HAS_ERRORS", preview);
        }

        await tx.stockOpnameItem.update({
          where: {
            id: row.itemId,
          },
          data: {
            physicalStock: row.physicalStock,
            difference: row.difference,
            notes: row.notes || null,
            countedById: input.userId,
            countedAt: now,
            source: "IMPORT_EXCEL",
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return preview;
}

export async function updateStockOpnameItemPhysicalStock(input: {
  sessionId: string;
  itemId: string;
  physicalStock: number;
  notes?: string;
  userId: number;
}) {
  return prisma.$transaction(
    async (tx) => {
      const item = await tx.stockOpnameItem.findFirst({
        where: {
          id: input.itemId,
          sessionId: input.sessionId,
          session: {
            status: StockOpnameStatus.COUNTING,
          },
        },
        select: {
          id: true,
          systemStock: true,
        },
      });

      if (!item) {
        throw new StockOpnameError("ITEM_NOT_EDITABLE");
      }

      return tx.stockOpnameItem.update({
        where: {
          id: item.id,
        },
        data: {
          physicalStock: input.physicalStock,
          difference: input.physicalStock - item.systemStock,
          notes: readText(input.notes) || null,
          countedById: input.userId,
          countedAt: new Date(),
          source: "MANUAL_EDIT",
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function submitStockOpnameReview(input: {
  sessionId: string;
}) {
  const session = await prisma.stockOpnameSession.findUnique({
    where: {
      id: input.sessionId,
    },
    include: {
      items: {
        select: {
          id: true,
          physicalStock: true,
        },
      },
    },
  });

  if (!session) {
    throw new StockOpnameError("SESSION_NOT_FOUND");
  }

  if (session.status !== StockOpnameStatus.COUNTING) {
    throw new StockOpnameError("SESSION_NOT_COUNTING");
  }

  const missingCount = session.items.filter(
    (item) => item.physicalStock === null,
  ).length;

  if (missingCount > 0) {
    throw new StockOpnameError("MISSING_PHYSICAL_STOCK", {
      missingCount,
    });
  }

  return prisma.stockOpnameSession.update({
    where: {
      id: session.id,
    },
    data: {
      status: StockOpnameStatus.REVIEW,
    },
  });
}

export async function cancelStockOpname(input: {
  sessionId: string;
  userId: number;
  reason?: string;
}) {
  const result = await prisma.stockOpnameSession.updateMany({
    where: {
      id: input.sessionId,
      status: {
        in: [StockOpnameStatus.DRAFT, StockOpnameStatus.COUNTING, StockOpnameStatus.REVIEW],
      },
    },
    data: {
      status: StockOpnameStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledById: input.userId,
      cancelReason: readText(input.reason) || null,
    },
  });

  if (result.count !== 1) {
    throw new StockOpnameError("SESSION_NOT_CANCELLABLE");
  }
}

export async function approveStockOpname(input: {
  sessionId: string;
  userId: number;
}) {
  return prisma.$transaction(
    async (tx) => {
      const session = await tx.stockOpnameSession.findUnique({
        where: {
          id: input.sessionId,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  stock: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new StockOpnameError("SESSION_NOT_FOUND");
      }

      if (session.status !== StockOpnameStatus.REVIEW) {
        throw new StockOpnameError("SESSION_NOT_REVIEW");
      }

      const missing = session.items.filter(
        (item) => item.physicalStock === null,
      );

      if (missing.length > 0) {
        throw new StockOpnameError("MISSING_PHYSICAL_STOCK", {
          missingCount: missing.length,
        });
      }

      const staleItems = session.items
        .filter((item) => item.product.stock !== item.systemStock)
        .map((item) => ({
          itemId: item.id,
          productId: item.productId,
          sku: item.productSkuSnapshot,
          name: item.productNameSnapshot,
          snapshotStock: item.systemStock,
          currentStock: item.product.stock,
        }));

      if (staleItems.length > 0) {
        throw new StockOpnameError("STALE_STOCK", {
          items: staleItems.slice(0, 50),
          total: staleItems.length,
        });
      }

      const approvedAt = new Date();
      const approvedUpdate = await tx.stockOpnameSession.updateMany({
        where: {
          id: session.id,
          status: StockOpnameStatus.REVIEW,
        },
        data: {
          status: StockOpnameStatus.APPROVED,
          approvedAt,
          approvedById: input.userId,
        },
      });

      if (approvedUpdate.count !== 1) {
        throw new StockOpnameError("SESSION_NOT_REVIEW");
      }

      let movementCount = 0;
      let changedItems = 0;

      for (const item of session.items) {
        const physicalStock = item.physicalStock ?? item.systemStock;
        const stockBefore = item.product.stock;
        const stockAfter = physicalStock;
        const delta = stockAfter - stockBefore;
        const productUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: stockBefore,
          },
          data: {
            stock: stockAfter,
          },
        });

        if (productUpdate.count !== 1) {
          throw new StockOpnameError("STALE_STOCK", {
            items: [
              {
                itemId: item.id,
                productId: item.productId,
                sku: item.productSkuSnapshot,
                name: item.productNameSnapshot,
                snapshotStock: item.systemStock,
                currentStock: null,
              },
            ],
            total: 1,
          });
        }

        await tx.stockOpnameItem.update({
          where: {
            id: item.id,
          },
          data: {
            approvalStockBefore: stockBefore,
            approvalStockAfter: stockAfter,
            approvalDelta: delta,
          },
        });

        if (delta !== 0) {
          changedItems += 1;
          movementCount += 1;
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              stockOpnameSessionId: session.id,
              stockOpnameItemId: item.id,
              createdById: input.userId,
              type: STOCK_OPNAME_MOVEMENT_TYPE,
              qty: delta,
              stockBefore,
              stockAfter,
              reference: session.opnameNumber,
              notes: `Stock Opname ${session.opnameNumber}`,
            },
          });
        }
      }

      return {
        id: session.id,
        opnameNumber: session.opnameNumber,
        changedItems,
        movementCount,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export function stockOpnameErrorPayload(error: unknown) {
  if (!(error instanceof StockOpnameError)) {
    return {
      message: "Terjadi kesalahan pada Stock Opname.",
      status: 500,
    };
  }

  const map: Record<string, { message: string; status: number }> = {
    NO_PRODUCTS: {
      message: "Tidak ada produk aktif untuk dibuat sesi Stock Opname.",
      status: 422,
    },
    SESSION_NOT_FOUND: {
      message: "Sesi Stock Opname tidak ditemukan.",
      status: 404,
    },
    SESSION_NOT_COUNTING: {
      message: "Import atau edit hanya bisa dilakukan saat status COUNTING.",
      status: 422,
    },
    SESSION_NOT_REVIEW: {
      message: "Approval hanya bisa dilakukan saat status REVIEW.",
      status: 422,
    },
    SESSION_NOT_CANCELLABLE: {
      message: "Sesi tidak bisa dibatalkan.",
      status: 422,
    },
    ITEM_NOT_EDITABLE: {
      message: "Item tidak ditemukan atau sesi sudah tidak bisa diedit.",
      status: 422,
    },
    EMPTY_FILE: {
      message: "File Excel tidak memiliki baris Stock Opname.",
      status: 422,
    },
    TOO_MANY_ROWS: {
      message: "Maksimal import Stock Opname 10.000 row.",
      status: 422,
    },
    IMPORT_HAS_ERRORS: {
      message: "Import dibatalkan karena masih ada row error.",
      status: 422,
    },
    MISSING_PHYSICAL_STOCK: {
      message: "Masih ada item yang belum memiliki stok fisik.",
      status: 422,
    },
    STALE_STOCK: {
      message:
        "Approval diblokir karena stok produk sudah berubah dari snapshot.",
      status: 409,
    },
  };

  return {
    ...(map[error.message] ?? {
      message: "Terjadi kesalahan pada Stock Opname.",
      status: 500,
    }),
    details: error.details,
  };
}
