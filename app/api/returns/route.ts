import { requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isReturnReason } from "@/lib/returns";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type ReturnItemInput = {
  sale_item_id: string;
  qty: number;
};

function accessWhere(session: { role: string | null; sub: number }) {
  return session.role === "cashier" ? { sale: { cashierId: session.sub } } : {};
}

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const where: Prisma.SaleReturnWhereInput = {
    returnType: "CUSTOMER_RETURN",
    ...accessWhere(auth.session),
    ...(q
      ? {
          OR: [
            {
              sale: {
                invoiceNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
            {
              sale: {
                customer: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const returns = await prisma.saleReturn.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      reason: true,
      notes: true,
      status: true,
      totalRefund: true,
      createdAt: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          createdAt: true,
          cashier: {
            select: {
              name: true,
            },
          },
          customer: {
            select: {
              name: true,
            },
          },
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
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const saleId = String(body.sale_id ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const items = (body.items ?? []) as ReturnItemInput[];

  if (!saleId) {
    return NextResponse.json(
      { message: "Transaksi penjualan wajib dipilih." },
      { status: 422 },
    );
  }

  if (!isReturnReason(reason)) {
    return NextResponse.json(
      { message: "Alasan retur wajib dipilih." },
      { status: 422 },
    );
  }

  if (reason === "LAINNYA" && !notes) {
    return NextResponse.json(
      { message: "Notes wajib diisi untuk alasan Lainnya." },
      { status: 422 },
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { message: "Minimal 1 item retur wajib dipilih." },
      { status: 422 },
    );
  }

  const requestedQty = new Map<string, number>();

  for (const [index, item] of items.entries()) {
    const saleItemId = String(item.sale_item_id ?? "").trim();
    const qty = Number(item.qty);

    if (!saleItemId) {
      return NextResponse.json(
        { message: `Item retur ${index + 1} tidak valid.` },
        { status: 422 },
      );
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { message: `Qty retur item ${index + 1} wajib lebih dari 0.` },
        { status: 422 },
      );
    }

    requestedQty.set(saleItemId, (requestedQty.get(saleItemId) ?? 0) + qty);
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: {
            id: saleId,
            ...(auth.session.role === "cashier"
              ? { cashierId: auth.session.sub }
              : {}),
          },
          select: {
            id: true,
            invoiceNumber: true,
            cashierId: true,
          },
        });

        if (!sale) {
          throw new Error("SALE_NOT_FOUND");
        }

        const saleItemIds = [...requestedQty.keys()];
        const saleItems = await tx.saleItem.findMany({
          where: {
            id: {
              in: saleItemIds,
            },
            saleId: sale.id,
          },
          select: {
            id: true,
            productId: true,
            qty: true,
            price: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                stock: true,
              },
            },
          },
        });
        const saleItemMap = new Map(saleItems.map((item) => [item.id, item]));

        for (const saleItemId of saleItemIds) {
          if (!saleItemMap.has(saleItemId)) {
            throw new Error("SALE_ITEM_NOT_FOUND");
          }
        }

        const returnedGroups = saleItemIds.length
          ? await tx.saleReturnItem.groupBy({
              by: ["saleItemId"],
              where: {
                saleItemId: {
                  in: saleItemIds,
                },
                saleReturn: {
                  returnType: "CUSTOMER_RETURN",
                },
              },
              _sum: {
                qty: true,
              },
            })
          : [];
        const returnedQty = new Map(
          returnedGroups.map((item) => [item.saleItemId, item._sum.qty ?? 0]),
        );
        const preparedItems = [];

        for (const [saleItemId, qty] of requestedQty) {
          const saleItem = saleItemMap.get(saleItemId);

          if (!saleItem) {
            throw new Error("SALE_ITEM_NOT_FOUND");
          }

          const alreadyReturned = returnedQty.get(saleItemId) ?? 0;
          const maxReturn = saleItem.qty - alreadyReturned;

          if (qty > maxReturn) {
            throw new Error(
              `RETURN_QTY_EXCEEDED:${saleItem.product.name}:${maxReturn}`,
            );
          }

          preparedItems.push({
            saleItemId,
            productId: saleItem.productId,
            productName: saleItem.product.name,
            productSku: saleItem.product.sku,
            stockBefore: saleItem.product.stock,
            qty,
            price: saleItem.price,
            subtotal: qty * saleItem.price,
          });
        }

        const totalRefund = preparedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        const createdReturn = await tx.saleReturn.create({
          data: {
            returnType: "CUSTOMER_RETURN",
            saleId: sale.id,
            createdById: auth.session.sub,
            reason,
            notes: notes || null,
            status: "COMPLETED",
            totalRefund,
          },
        });
        const responseItems = [];
        const runningStock = new Map(
          preparedItems.map((item) => [item.productId, item.stockBefore]),
        );

        for (const item of preparedItems) {
          const stockBefore =
            runningStock.get(item.productId) ?? item.stockBefore;
          const stockAfter = stockBefore + item.qty;
          const updatedProduct = await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                increment: item.qty,
              },
            },
            select: {
              stock: true,
            },
          });
          runningStock.set(item.productId, updatedProduct.stock);

          const returnItem = await tx.saleReturnItem.create({
            data: {
              returnId: createdReturn.id,
              saleItemId: item.saleItemId,
              productId: item.productId,
              qty: item.qty,
              price: item.price,
              subtotal: item.subtotal,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              saleId: sale.id,
              saleItemId: item.saleItemId,
              createdById: auth.session.sub,
              type: "CUSTOMER_RETURN_IN",
              qty: item.qty,
              stockBefore,
              stockAfter,
              reference: createdReturn.id,
              notes: `Retur ${reason}${notes ? ` - ${notes}` : ""}`,
            },
          });

          responseItems.push({
            id: returnItem.id,
            sale_item_id: item.saleItemId,
            product_id: item.productId,
            product_sku: item.productSku,
            product_name: item.productName,
            qty: item.qty,
            price: item.price,
            subtotal: item.subtotal,
            stock_before: stockBefore,
            stock_after: stockAfter,
          });
        }

        return {
          id: createdReturn.id,
          sale_id: sale.id,
          invoice_number: sale.invoiceNumber,
          reason,
          notes: createdReturn.notes,
          status: createdReturn.status,
          total_refund: totalRefund,
          items: responseItems,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/returns");
    revalidatePath("/sales");
    revalidatePath(`/invoices/${saleId}`);

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
      if (error.message === "SALE_NOT_FOUND") {
        return NextResponse.json(
          { message: "Transaksi tidak ditemukan atau tidak bisa diakses." },
          { status: 404 },
        );
      }

      if (error.message === "SALE_ITEM_NOT_FOUND") {
        return NextResponse.json(
          { message: "Item transaksi tidak valid." },
          { status: 422 },
        );
      }

      if (error.message.startsWith("RETURN_QTY_EXCEEDED:")) {
        const [, productName, maxReturn] = error.message.split(":");

        return NextResponse.json(
          {
            message: `Qty retur ${productName} melebihi sisa yang bisa diretur. Maksimal ${maxReturn}.`,
          },
          { status: 422 },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      { message: "Gagal membuat retur. Semua perubahan dibatalkan." },
      { status: 500 },
    );
  }
}
