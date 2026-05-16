import { requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

type PurchaseItemInput = {
  product_id: number;
  quantity: number;
  cost_price: number;
};

function purchaseNumber() {
  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "")
    .slice(0, 14);

  return `PO-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const supplierId = Number(body.supplier_id);
  const items = (body.items ?? []) as PurchaseItemInput[];
  const notes = String(body.notes ?? "").trim();

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json(
      {
        message: "Supplier wajib dipilih.",
      },
      {
        status: 422,
      },
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      {
        message: "Item pembelian masih kosong.",
      },
      {
        status: 422,
      },
    );
  }

  const seenProductIds = new Set<number>();
  const requiredProductIds: number[] = [];

  for (const [index, item] of items.entries()) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);
    const costPrice = Number(item.cost_price);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        {
          message: `Produk item ${index + 1} tidak valid.`,
        },
        {
          status: 422,
        },
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        {
          message: `Qty item ${index + 1} wajib lebih dari 0.`,
        },
        {
          status: 422,
        },
      );
    }

    if (!Number.isInteger(costPrice) || costPrice < 0) {
      return NextResponse.json(
        {
          message: `Harga beli item ${index + 1} tidak valid.`,
        },
        {
          status: 422,
        },
      );
    }

    if (seenProductIds.has(productId)) {
      return NextResponse.json(
        {
          message: "Produk duplikat dalam pembelian.",
        },
        {
          status: 422,
        },
      );
    }

    seenProductIds.add(productId);
    requiredProductIds.push(productId);
  }

  try {
    const purchase = await prisma.$transaction(
      async (tx) => {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: supplierId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!supplier) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }

        const products = await tx.product.findMany({
          where: {
            id: {
              in: requiredProductIds,
            },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
          },
        });
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        for (const productId of requiredProductIds) {
          if (!productMap.has(productId)) {
            throw new Error("PRODUCT_NOT_FOUND");
          }
        }

        const preparedItems = items.map((item) => {
          const productId = Number(item.product_id);
          const quantity = Number(item.quantity);
          const costPrice = Number(item.cost_price);
          const product = productMap.get(productId);

          return {
            productId,
            productName: product?.name ?? "",
            productSku: product?.sku ?? null,
            quantity,
            costPrice,
            subtotal: quantity * costPrice,
          };
        });
        const total = preparedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        const reference = purchaseNumber();

        const createdPurchase = await tx.purchase.create({
          data: {
            purchaseNumber: reference,
            supplierId: supplier.id,
            userId: auth.session.sub,
            status: "completed",
            subtotal: total,
            total,
            paidAmount: total,
            notes: notes || null,
          },
        });

        const responseItems = [];

        for (const item of preparedItems) {
          const product = productMap.get(item.productId);
          const stockBefore = product?.stock ?? 0;
          const stockAfter = stockBefore + item.quantity;

          const purchaseItem = await tx.purchaseItem.create({
            data: {
              purchaseId: createdPurchase.id,
              productId: item.productId,
              qty: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
            },
          });

          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                increment: item.quantity,
              },
              costPrice: item.costPrice,
              supplierId: supplier.id,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              purchaseId: createdPurchase.id,
              purchaseItemId: purchaseItem.id,
              createdById: auth.session.sub,
              type: "IN",
              qty: item.quantity,
              stockBefore,
              stockAfter,
              reference,
              notes: "Pembelian stok masuk",
            },
          });

          responseItems.push({
            id: purchaseItem.id,
            product_id: item.productId,
            product_sku: item.productSku,
            product_name: item.productName,
            quantity: item.quantity,
            cost_price: item.costPrice,
            subtotal: item.subtotal,
            stock_before: stockBefore,
            stock_after: stockAfter,
          });
        }

        return {
          id: createdPurchase.id,
          purchase_number: createdPurchase.purchaseNumber,
          supplier: {
            id: supplier.id,
            name: supplier.name,
          },
          status: createdPurchase.status,
          subtotal: total,
          total,
          items: responseItems,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json(
      {
        data: purchase,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SUPPLIER_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Supplier tidak ditemukan atau tidak aktif.",
          },
          {
            status: 422,
          },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produk tidak ditemukan atau tidak aktif.",
          },
          {
            status: 422,
          },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal membuat pembelian.",
      },
      {
        status: 500,
      },
    );
  }
}
