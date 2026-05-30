import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const query = String(searchParams.get("query") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({
      data: [],
    });
  }

  const sales = await prisma.sale.findMany({
    where: {
      ...FINAL_SALE_STATUS_WHERE,
      OR: [
        {
          invoiceNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          customer: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          customer: {
            phone: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          cashier: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      subtotal: true,
      paymentMethod: true,
      cashier: {
        select: {
          name: true,
          role: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
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
      },
    },
  });
  const saleItemIds = sales.flatMap((sale) => sale.items.map((item) => item.id));
  const returnedGroups = saleItemIds.length
    ? await prisma.saleReturnItem.groupBy({
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

  return NextResponse.json({
    data: sales.map((sale) => ({
      id: sale.id,
      invoice_number: sale.invoiceNumber,
      created_at: sale.createdAt,
      subtotal: sale.subtotal,
      cashier: sale.cashier,
      customer: sale.customer,
      payment_method: sale.paymentMethod,
      item_count: sale.items.length,
      items: sale.items.map((item) => {
        const returned = returnedQty.get(item.id) ?? 0;
        const effectiveUnitPrice =
          item.qty > 0 ? Math.round(item.subtotal / item.qty) : item.price;

        return {
          id: item.id,
          product_id: item.product.id,
          product_name: item.product.name,
          product_sku: item.product.sku,
          qty_sold: item.qty,
          qty_returned: returned,
          max_return_qty: Math.max(item.qty - returned, 0),
          price: effectiveUnitPrice,
          original_price: item.price,
          subtotal: item.subtotal,
          current_stock: item.product.stock,
        };
      }),
    })),
  });
}
