import type { Prisma, PrismaClient } from "@prisma/client";

import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";

export const DAILY_CLOSING_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
} as const;

export type DailyClosingStatus =
  (typeof DAILY_CLOSING_STATUS)[keyof typeof DAILY_CLOSING_STATUS];

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

export function closingDateFromInput(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);

  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);

  return next;
}

export async function getDailyClosing(
  client: PrismaLike,
  closingDate: Date,
) {
  return client.dailyClosing.findUnique({
    where: {
      closingDate,
    },
    include: {
      closedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reopenedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      logs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function isClosingLockedForDate(
  client: PrismaLike,
  closingDate: Date,
) {
  const closing = await client.dailyClosing.findUnique({
    where: {
      closingDate,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return closing?.status === DAILY_CLOSING_STATUS.CLOSED;
}

export async function buildDailyClosingSnapshot(
  client: PrismaLike,
  closingDate: Date,
) {
  const dayStart = startOfDay(closingDate);
  const dayEnd = endOfDay(closingDate);
  const saleWhere = {
    createdAt: {
      gte: dayStart,
      lte: dayEnd,
    },
    ...FINAL_SALE_STATUS_WHERE,
  };
  const [sales, paymentSummary, returns] = await Promise.all([
    client.sale.aggregate({
      where: saleWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    client.sale.groupBy({
      by: ["paymentMethod"],
      where: saleWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          subtotal: "desc",
        },
      },
    }),
    client.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        sale: FINAL_SALE_STATUS_WHERE,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);
  const paymentRows = paymentSummary.map((item) => ({
    method: item.paymentMethod,
    total: item._sum.subtotal ?? 0,
    count: item._count._all,
  }));
  const grossOmzet = sales._sum.subtotal ?? 0;
  const returnValue = returns._sum.totalRefund ?? 0;
  const expectedCash =
    paymentRows.find((item) => item.method.toUpperCase() === "CASH")?.total ?? 0;

  return {
    expectedCash,
    grossOmzet,
    netOmzet: Math.max(grossOmzet - returnValue, 0),
    transactionCount: sales._count._all,
    paymentSummary: paymentRows,
    returnValue,
  };
}
