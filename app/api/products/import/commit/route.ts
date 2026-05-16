import { requireOwner } from "@/lib/auth-session";
import {
  buildProductImportPreview,
  buildSkuFromName,
  supplierCode,
  type ProductImportInput,
} from "@/lib/product-import";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CommitBody = {
  rows?: ProductImportInput[];
};

function normalizeSupplierKey(name: string) {
  return name.trim().toLowerCase();
}

async function uniqueGeneratedSku(
  tx: Prisma.TransactionClient,
  name: string,
  index: number,
  reservedSkus: Set<string>,
) {
  let attempt = 0;

  while (attempt < 20) {
    const sku = buildSkuFromName(name, index + attempt);

    if (!reservedSkus.has(sku)) {
      const existing = await tx.product.findUnique({
        where: { sku },
        select: { id: true },
      });

      if (!existing) {
        reservedSkus.add(sku);
        return sku;
      }
    }

    attempt += 1;
  }

  throw new Error("SKU_GENERATION_FAILED");
}

export async function POST(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json()) as CommitBody;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const preview = await buildProductImportPreview(rows);

    if (preview.summary.errorRows > 0) {
      return NextResponse.json(
        {
          message: "Import dibatalkan karena masih ada row error.",
          data: preview,
        },
        {
          status: 422,
        },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const supplierNames = [
          ...new Set(
            preview.rows
              .map((row) => row.supplier)
              .filter(Boolean)
              .map((name) => name.trim()),
          ),
        ];
        const existingSuppliers = supplierNames.length
          ? await tx.supplier.findMany({
              where: {
                OR: supplierNames.map((name) => ({
                  name: {
                    equals: name,
                    mode: "insensitive",
                  },
                })),
              },
              select: {
                id: true,
                name: true,
              },
            })
          : [];
        const supplierMap = new Map(
          existingSuppliers.map((supplier) => [
            normalizeSupplierKey(supplier.name),
            supplier.id,
          ]),
        );
        const reservedSkus = new Set(
          preview.rows.map((row) => row.sku).filter(Boolean),
        );
        const imported = [];

        for (const [index, row] of preview.rows.entries()) {
          const sku =
            row.sku || (await uniqueGeneratedSku(tx, row.name, index + 1, reservedSkus));
          let supplierId: number | null = null;

          if (row.supplier) {
            const key = normalizeSupplierKey(row.supplier);
            supplierId = supplierMap.get(key) ?? null;

            if (!supplierId) {
              const supplier = await tx.supplier.create({
                data: {
                  code: supplierCode(),
                  name: row.supplier,
                  isActive: true,
                  deletedAt: null,
                },
                select: {
                  id: true,
                },
              });
              supplierId = supplier.id;
              supplierMap.set(key, supplier.id);
            }
          }

          const existingProduct = await tx.product.findUnique({
            where: {
              sku,
            },
            select: {
              id: true,
              stock: true,
            },
          });

          const product = existingProduct
            ? await tx.product.update({
                where: {
                  id: existingProduct.id,
                },
                data: {
                  name: row.name,
                  description: row.notes || null,
                  price: row.sellPrice,
                  costPrice: row.costPrice,
                  stock: row.stock,
                  minStock: row.minStock,
                  unit: row.unit || "pcs",
                  category: row.category || null,
                  supplierId,
                  isActive: true,
                },
                select: {
                  id: true,
                  sku: true,
                  stock: true,
                },
              })
            : await tx.product.create({
                data: {
                  sku,
                  name: row.name,
                  description: row.notes || null,
                  price: row.sellPrice,
                  costPrice: row.costPrice,
                  stock: row.stock,
                  minStock: row.minStock,
                  unit: row.unit || "pcs",
                  category: row.category || null,
                  supplierId,
                  isActive: true,
                },
                select: {
                  id: true,
                  sku: true,
                  stock: true,
                },
              });
          const stockBefore = existingProduct?.stock ?? 0;
          const stockAfter = row.stock;
          const delta = stockAfter - stockBefore;

          if (delta !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                createdById: auth.session.sub,
                type: "IMPORT",
                qty: delta,
                stockBefore,
                stockAfter,
                reference: `IMPORT-${Date.now()}`,
                notes: existingProduct
                  ? "Import Excel produk: penyesuaian stok"
                  : "Import Excel produk: stok awal",
              },
            });
          }

          imported.push({
            id: product.id,
            sku: product.sku,
            name: row.name,
            stock_before: stockBefore,
            stock_after: stockAfter,
            stock_delta: delta,
            action: existingProduct ? "updated" : "created",
          });
        }

        return {
          total: imported.length,
          created: imported.filter((row) => row.action === "created").length,
          updated: imported.filter((row) => row.action === "updated").length,
          items: imported,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/products");
    revalidatePath("/products/import");
    revalidatePath("/pos");
    revalidatePath("/purchases");

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EMPTY_FILE") {
        return NextResponse.json(
          { message: "Data import kosong." },
          { status: 422 },
        );
      }

      if (error.message === "TOO_MANY_ROWS") {
        return NextResponse.json(
          { message: "Maksimal import 5.000 row." },
          { status: 422 },
        );
      }

      if (error.message === "SKU_GENERATION_FAILED") {
        return NextResponse.json(
          { message: "Gagal membuat SKU otomatis yang unik." },
          { status: 500 },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      { message: "Import produk gagal. Semua perubahan dibatalkan." },
      { status: 500 },
    );
  }
}
