import { canAccessCustomers, isOwnerRole, requireCashier } from "@/lib/auth-session";
import { loyaltyProgressFromValidCount } from "@/lib/loyalty";
import { getLoyaltyConfig } from "@/lib/loyalty-settings";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

async function getCustomerLoyaltyProgress(customerId: number) {
  const [validTransactions, reservedSales] = await Promise.all([
    prisma.sale.count({
      where: {
        customerId,
        ...FINAL_SALE_STATUS_WHERE,
      },
    }),
    prisma.sale.findMany({
      where: {
        customerId,
        transactionStatus: "PENDING",
        paymentStatus: "WAITING_PROOF",
        loyaltyApplied: true,
        loyaltyMilestone: {
          not: null,
        },
      },
      select: {
        loyaltyMilestone: true,
      },
    }),
  ]);
  const loyaltyConfig = await getLoyaltyConfig();
  const progress = loyaltyProgressFromValidCount(
    validTransactions,
    loyaltyConfig.interval,
  );

  return {
    valid_transactions: progress.validTransactions,
    next_milestone: progress.nextMilestone,
    remaining_to_next: progress.remainingToNext,
    eligible_milestone: progress.eligibleMilestone,
    reserved_milestones: reservedSales
      .map((sale) => sale.loyaltyMilestone)
      .filter((milestone): milestone is number => milestone !== null),
  };
}

export async function GET(req: Request) {
  const auth = await requireCashier(req);

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
        loyaltyPoints: true,
      },
    });
    const loyaltyProgress = customer
      ? await getCustomerLoyaltyProgress(customer.id)
      : null;

    return NextResponse.json({
      data: customer
        ? {
            ...customer,
            loyalty_progress: loyaltyProgress,
          }
        : null,
      normalized_phone: phone,
      found: Boolean(customer),
    });
  }

  const q = String(searchParams.get("q") ?? "").trim();
  const lookup = String(searchParams.get("lookup") ?? "").trim();
  const searchType = String(searchParams.get("type") ?? "").trim();
  const take = Math.min(
    Math.max(Number(searchParams.get("limit") ?? (lookup === "pos" ? 8 : 25)) || 25, 1),
    25,
  );
  const rawQueryDigits = q.replace(/\D/g, "");
  const normalizedQueryPhone = normalizeIndonesianPhone(q);
  const phoneFilters: Prisma.CustomerWhereInput[] = rawQueryDigits
    ? [
        {
          phone: {
            startsWith: normalizedQueryPhone || rawQueryDigits,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: normalizedQueryPhone || rawQueryDigits,
            mode: "insensitive",
          },
        },
        {
          phone: {
            endsWith: normalizedQueryPhone || rawQueryDigits,
            mode: "insensitive",
          },
        },
        {
          phone: {
            startsWith: rawQueryDigits,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: rawQueryDigits,
            mode: "insensitive",
          },
        },
        {
          phone: {
            endsWith: rawQueryDigits,
            mode: "insensitive",
          },
        },
      ]
    : [];
  const nameFilters: Prisma.CustomerWhereInput[] = q
    ? [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
      ]
    : [];
  const customerCodeFilters: Prisma.CustomerWhereInput[] = q
    ? [
        {
          customerCode: {
            contains: q,
            mode: "insensitive",
          },
        },
      ]
    : [];
  const searchFilters =
    searchType === "phone"
      ? phoneFilters
      : searchType === "name"
        ? nameFilters
        : [...nameFilters, ...phoneFilters, ...customerCodeFilters];
  const where: Prisma.CustomerWhereInput = {
    isActive: true,
    deletedAt: null,
    ...(q && searchFilters.length ? { OR: searchFilters } : {}),
  };
  const customers = await prisma.customer.findMany({
    where,
    orderBy: {
      updatedAt: "desc",
    },
    take,
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
  const customerPayload = await Promise.all(
    customers.map(async (item) => ({
      id: item.id,
      customer_code: item.customerCode,
      name: item.name,
      phone: item.phone,
      address: item.address,
      notes: item.notes,
      loyalty_points: item.loyaltyPoints,
      ...(lookup === "pos"
        ? { loyalty_progress: await getCustomerLoyaltyProgress(item.id) }
        : {}),
      ...(canViewAnalytics ? { total_transactions: item._count.sales } : {}),
    })),
  );

  return NextResponse.json({
    data: customerPayload,
  });
}
