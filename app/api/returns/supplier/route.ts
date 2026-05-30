import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type SupplierReturnItemInput = {
  product_id: number;
  qty: number;
};

function supplierReturnNumber() {
  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "")
    .slice(0, 14);

  return `SR-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const returns = await prisma.supplierReturn.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      returnNumber: true,
      reason: true,
      notes: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      supplier: {
        select: {
          name: true,
          type: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: returns,
  });
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const supplierId = Number(body.supplier_id);
  const reason = String(body.reason ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const items = (body.items ?? []) as SupplierReturnItemInput[];

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json(
      { message: "Supplier/distributor wajib dipilih." },
      { status: 422 },
    );
  }

  if (!reason) {
    return NextResponse.json(
      { message: "Alasan retur supplier wajib diisi." },
      { status: 422 },
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { message: "Minimal 1 item retur supplier wajib dipilih." },
      { status: 422 },
    );
  }

  const requestedQty = new Map<number, number>();

  for (const [index, item] of items.entries()) {
    const productId = Number(item.product_id);
    const qty = Number(item.qty);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { message: `Produk item ${index + 1} tidak valid.` },
        { status: 422 },
      );
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { message: `Qty item ${index + 1} wajib lebih dari 0.` },
        { status: 422 },
      );
    }

    requestedQty.set(productId, (requestedQty.get(productId) ?? 0) + qty);
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: supplierId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            type: true,
          },
        });

        if (!supplier) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }

        const productIds = [...requestedQty.keys()];
        const products = await tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            costPrice: true,
          },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));

        for (const productId of productIds) {
          if (!productMap.has(productId)) {
            throw new Error("PRODUCT_NOT_FOUND");
          }
        }

        const preparedItems = productIds.map((productId) => {
          const product = productMap.get(productId);
          const qty = requestedQty.get(productId) ?? 0;

          if (!product) {
            throw new Error("PRODUCT_NOT_FOUND");
          }

          if (qty > product.stock) {
            throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.stock}`);
          }

          return {
            productId,
            productName: product.name,
            productSku: product.sku,
            stockBefore: product.stock,
            qty,
            costPrice: product.costPrice,
            subtotal: qty * product.costPrice,
          };
        });
        const totalAmount = preparedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        const returnNumber = supplierReturnNumber();
        const createdReturn = await tx.supplierReturn.create({
          data: {
            returnNumber,
            supplierId: supplier.id,
            createdById: auth.session.sub,
            reason,
            notes: notes || null,
            totalAmount,
            status: "COMPLETED",
          },
        });
        const responseItems = [];

        for (const item of preparedItems) {
          const stockAfter = item.stockBefore - item.qty;
          const returnItem = await tx.supplierReturnItem.create({
            data: {
              supplierReturnId: createdReturn.id,
              productId: item.productId,
              qty: item.qty,
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
                decrement: item.qty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              supplierReturnId: createdReturn.id,
              supplierReturnItemId: returnItem.id,
              createdById: auth.session.sub,
              type: "SUPPLIER_RETURN_OUT",
              qty: item.qty,
              stockBefore: item.stockBefore,
              stockAfter,
              reference: returnNumber,
              notes: `Retur ke ${supplier.type === "DISTRIBUTOR" ? "distributor" : "supplier"}: ${reason}${notes ? ` - ${notes}` : ""}`,
            },
          });

          responseItems.push({
            id: returnItem.id,
            product_id: item.productId,
            product_sku: item.productSku,
            product_name: item.productName,
            qty: item.qty,
            cost_price: item.costPrice,
            subtotal: item.subtotal,
            stock_before: item.stockBefore,
            stock_after: stockAfter,
          });
        }

        return {
          id: createdReturn.id,
          return_number: createdReturn.returnNumber,
          supplier: {
            id: supplier.id,
            name: supplier.name,
            type: supplier.type,
          },
          reason,
          notes: createdReturn.notes,
          total_amount: totalAmount,
          status: createdReturn.status,
          items: responseItems,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/returns");
    revalidatePath("/returns/supplier");
    revalidatePath("/reports");
    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        data: result,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SUPPLIER_NOT_FOUND") {
        return NextResponse.json(
          { message: "Supplier/distributor tidak ditemukan atau tidak aktif." },
          { status: 422 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { message: "Produk tidak ditemukan atau tidak aktif." },
          { status: 422 },
        );
      }

      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const [, productName, stock] = error.message.split(":");

        return NextResponse.json(
          {
            message: `Stok ${productName} tidak cukup. Stok saat ini ${stock}.`,
          },
          { status: 422 },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      { message: "Gagal membuat retur supplier. Semua perubahan dibatalkan." },
      { status: 500 },
    );
  }
}
