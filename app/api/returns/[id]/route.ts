import { requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const saleReturn = await prisma.saleReturn.findFirst({
    where: {
      id,
      returnType: "CUSTOMER_RETURN",
      ...(auth.session.role === "cashier"
        ? { sale: { cashierId: auth.session.sub } }
        : {}),
    },
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
          paymentMethod: true,
          cashier: {
            select: {
              name: true,
            },
          },
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          name: true,
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
            },
          },
        },
      },
    },
  });

  if (!saleReturn) {
    return NextResponse.json(
      { message: "Retur tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: saleReturn,
  });
}
