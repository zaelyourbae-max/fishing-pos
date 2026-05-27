import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import {
  daysSince,
  DEAD_STOCK_THRESHOLD_DAYS,
  getDeadStockWhere,
} from "@/lib/product-analytics";

export type DeadStockReason = "NEVER_SOLD" | "NOT_SOLD_OVER_THRESHOLD";

export type DeadStockProduct = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  lastSoldAt: Date | null;
  daysSinceLastSold: number | null;
  reason: DeadStockReason;
};

export async function getDeadStockProducts({
  limit = 5,
  thresholdDays = DEAD_STOCK_THRESHOLD_DAYS,
}: {
  limit?: number;
  thresholdDays?: number;
} = {}) {
  const now = new Date();
  const where = {
    isActive: true,
    ...getDeadStockWhere({
      now,
      thresholdDays,
    }),
  };
  const [total, products] = await Promise.all([
    prisma.product.count({
      where,
    }),
    prisma.product.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      take: Math.max(limit * 8, limit),
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        createdAt: true,
        saleItems: {
          where: {
            sale: FINAL_SALE_STATUS_WHERE,
          },
          select: {
            sale: {
              select: {
                createdAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const items = products
    .map((product): DeadStockProduct => {
      const lastSoldAt =
        product.saleItems.reduce<Date | null>((latest, item) => {
          const soldAt = item.sale.createdAt;

          if (!latest || soldAt > latest) {
            return soldAt;
          }

          return latest;
        }, null) ?? null;

      const referenceDate = lastSoldAt ?? product.createdAt;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        lastSoldAt,
        daysSinceLastSold: daysSince(referenceDate, now),
        reason: lastSoldAt ? "NOT_SOLD_OVER_THRESHOLD" : "NEVER_SOLD",
      };
    })
    .sort((a, b) => {
      if (a.lastSoldAt === null && b.lastSoldAt !== null) return -1;
      if (a.lastSoldAt !== null && b.lastSoldAt === null) return 1;

      return (b.daysSinceLastSold ?? 0) - (a.daysSinceLastSold ?? 0);
    })
    .slice(0, limit);

  return {
    total,
    thresholdDays,
    items,
  };
}
