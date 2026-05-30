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
  name: string,
  index: number,
  reservedSkus: Set<string>,
  existingSkus: Set<string>,
) {
  let attempt = 0;

  while (attempt < 100) {
    const sku = buildSkuFromName(name, index + attempt);

    if (!reservedSkus.has(sku) && !existingSkus.has(sku)) {
      reservedSkus.add(sku);
      existingSkus.add(sku);
      return sku;
    }

    attempt += 1;
  }

  throw new Error("SKU_GENERATION_FAILED");
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json()) as CommitBody;
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Data preview kosong. Jalankan preview terlebih dahulu." },
        { status: 422 },
      );
    }

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
        const supplierOrFilter = supplierNames.map((name) => ({
          name: {
            equals: name,
            mode: "insensitive" as const,
          },
        }));
        const existingSuppliers = supplierOrFilter.length
          ? await tx.supplier.findMany({
              where: {
                OR: supplierOrFilter,
              },
              select: {
                id: true,
                name: true,
              },
            })
          : [];
        const supplierMap = new Map<string, number>(
          existingSuppliers.map((supplier) => [
            normalizeSupplierKey(supplier.name),
            supplier.id,
          ]),
        );
        const missingSuppliers = supplierNames.filter(
          (name) => !supplierMap.has(normalizeSupplierKey(name)),
        );

        if (missingSuppliers.length > 0) {
          await tx.supplier.createMany({
            data: missingSuppliers.map((name) => ({
              code: supplierCode(),
              name,
              type: "SUPPLIER",
              isActive: true,
              deletedAt: null,
            })),
          });

          const reloadedSuppliers = await tx.supplier.findMany({
            where: {
              OR: supplierOrFilter,
            },
            select: {
              id: true,
              name: true,
            },
          });

          for (const supplier of reloadedSuppliers) {
            supplierMap.set(normalizeSupplierKey(supplier.name), supplier.id);
          }
        }

        const providedSkus = [
          ...new Set(preview.rows.map((row) => row.sku).filter(Boolean)),
        ];
        const providedBarcodes = [
          ...new Set(preview.rows.map((row) => row.barcode).filter(Boolean)),
        ];
        const [existingProductsBySku, existingProductsByBarcode] =
          await Promise.all([
            providedSkus.length
              ? tx.product.findMany({
                  where: {
                    sku: {
                      in: providedSkus,
                    },
                  },
                  select: {
                    id: true,
                    sku: true,
                    barcode: true,
                    stock: true,
                  },
                })
              : [],
            providedBarcodes.length
              ? tx.product.findMany({
                  where: {
                    barcode: {
                      in: providedBarcodes,
                    },
                  },
                  select: {
                    id: true,
                    sku: true,
                    barcode: true,
                    stock: true,
                  },
                })
              : [],
          ]);

        const productBySkuMap = new Map<
          string,
          { id: number; sku: string | null; barcode: string | null; stock: number }
        >();
        for (const product of existingProductsBySku) {
          if (!product.sku) {
            continue;
          }

          productBySkuMap.set(product.sku.toUpperCase(), product);
        }

        const productByBarcodeMap = new Map<
          string,
          { id: number; sku: string | null; barcode: string | null; stock: number }
        >();
        for (const product of existingProductsByBarcode) {
          if (!product.barcode) {
            continue;
          }

          productByBarcodeMap.set(product.barcode.toUpperCase(), product);
        }

        const existingSkus = new Set(
          existingProductsBySku
            .map((product) => product.sku?.toUpperCase())
            .filter((sku): sku is string => Boolean(sku)),
        );
        const reservedSkus = new Set(
          preview.rows.map((row) => row.sku).filter(Boolean),
        );
        const imported = [];

        for (const [index, row] of preview.rows.entries()) {
          const sku =
            row.sku ||
            (await uniqueGeneratedSku(
              row.name,
              index + 1,
              reservedSkus,
              existingSkus,
            ));
          let supplierId: number | null = null;

          if (row.supplier) {
            const key = normalizeSupplierKey(row.supplier);
            supplierId = supplierMap.get(key) ?? null;
          }

          const existingProduct = productBySkuMap.get(sku);
          const existingBarcodeOwner = row.barcode
            ? productByBarcodeMap.get(row.barcode)
            : null;

          if (
            row.barcode &&
            existingBarcodeOwner &&
            existingBarcodeOwner.id !== existingProduct?.id
          ) {
            throw new Error("BARCODE_CONFLICT");
          }

          const product = existingProduct
            ? await tx.product.update({
                where: {
                  id: existingProduct.id,
                },
                data: {
                  barcode: row.barcode || null,
                  name: row.name,
                  brand: row.brand || null,
                  type: row.type || null,
                  size: row.size || null,
                  variant: row.variant || null,
                  description: row.notes || null,
                  price: row.sellPrice,
                  costPrice: row.costPrice,
                  stock: row.stock,
                  minStock: row.minStock,
                  unit: row.unit,
                  category: row.category,
                  rackLocation: row.rackLocation || null,
                  supplierId,
                  isActive: true,
                },
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  stock: true,
                },
              })
            : await tx.product.create({
                data: {
                  sku,
                  barcode: row.barcode || null,
                  name: row.name,
                  brand: row.brand || null,
                  type: row.type || null,
                  size: row.size || null,
                  variant: row.variant || null,
                  description: row.notes || null,
                  price: row.sellPrice,
                  costPrice: row.costPrice,
                  stock: row.stock,
                  minStock: row.minStock,
                  unit: row.unit,
                  category: row.category,
                  rackLocation: row.rackLocation || null,
                  supplierId,
                  isActive: true,
                },
                select: {
                  id: true,
                  sku: true,
                  barcode: true,
                  stock: true,
                },
              });
          if (product.sku) {
            productBySkuMap.set(product.sku.toUpperCase(), {
              id: product.id,
              sku: product.sku,
              barcode: product.barcode,
              stock: product.stock,
            });
          }
          if (product.barcode) {
            productByBarcodeMap.set(product.barcode.toUpperCase(), {
              id: product.id,
              sku: product.sku,
              barcode: product.barcode,
              stock: product.stock,
            });
          }
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

      if (error.message === "BARCODE_CONFLICT") {
        return NextResponse.json(
          {
            message:
              "Import dibatalkan karena barcode sudah dipakai produk lain. Periksa file import Anda.",
          },
          { status: 422 },
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
