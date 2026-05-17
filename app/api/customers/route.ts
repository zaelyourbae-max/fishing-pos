import { canAccessCustomers, isOwnerRole, requireCashier } from "@/lib/auth-session";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }
  const { session } = auth;

  if (!canAccessCustomers(session.role)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawPhone = searchParams.get("phone");

  if (rawPhone !== null) {
    const phone = normalizeIndonesianPhone(rawPhone);

    if (!phone) {
      return NextResponse.json({
        data: null,
        normalized_phone: "",
        found: false,
      });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        phone,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        customerCode: true,
        name: true,
        phone: true,
        address: true,
        notes: true,
      },
    });

    return NextResponse.json({
      data: customer,
      normalized_phone: phone,
      found: Boolean(customer),
    });
  }

  const q = String(searchParams.get("q") ?? "").trim();
  const normalizedQueryPhone = normalizeIndonesianPhone(q);
  const where: Prisma.CustomerWhereInput = {
    isActive: true,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: normalizedQueryPhone || q,
                mode: "insensitive",
              },
            },
            {
              customerCode: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
  const customers = await prisma.customer.findMany({
    where,
    orderBy: {
      updatedAt: "desc",
    },
    take: 25,
    select: {
      id: true,
      customerCode: true,
      name: true,
      phone: true,
      address: true,
      notes: true,
      loyaltyPoints: true,
      _count: {
        select: {
          sales: true,
        },
      },
    },
  });
  const canViewAnalytics = isOwnerRole(session.role);

  return NextResponse.json({
    data: customers.map((item) => ({
      id: item.id,
      customer_code: item.customerCode,
      name: item.name,
      phone: item.phone,
      address: item.address,
      notes: item.notes,
      loyalty_points: item.loyaltyPoints,
      ...(canViewAnalytics ? { total_transactions: item._count.sales } : {}),
    })),
  });
}
