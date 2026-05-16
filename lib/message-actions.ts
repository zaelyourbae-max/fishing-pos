import { prisma } from "@/lib/prisma";

type SessionAccess = {
  role: string | null;
  sub: number;
};

export function invoiceUrl(saleId: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";

  return `${baseUrl.replace(/\/$/, "")}/invoices/${saleId}`;
}

export function canAccessSale(session: SessionAccess) {
  return session.role === "cashier" ? { cashierId: session.sub } : {};
}

export async function findSaleForMessage(saleId: string, session: SessionAccess) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      ...canAccessSale(session),
    },
    select: {
      id: true,
      invoiceNumber: true,
      paymentMethod: true,
      subtotal: true,
      paidAmount: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
          phone: true,
        },
      },
      cashier: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          qty: true,
          price: true,
          subtotal: true,
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });
}

export function saleMessagePayload(
  sale: NonNullable<Awaited<ReturnType<typeof findSaleForMessage>>>,
) {
  return {
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name ?? "Walk-in",
    customerPhone: sale.customer?.phone ?? null,
    cashierName: sale.cashier.name,
    paymentMethod: sale.paymentMethod,
    total: sale.subtotal,
    paidAmount: sale.paidAmount,
    itemCount: sale.items.reduce((sum, item) => sum + item.qty, 0),
    items: sale.items.map((item) => ({
      name: item.product.name,
      sku: item.product.sku,
      qty: item.qty,
      price: item.price,
      subtotal: item.subtotal,
    })),
    invoiceUrl: invoiceUrl(sale.id),
    createdAt: sale.createdAt.toISOString(),
  };
}
