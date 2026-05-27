import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";

export const SLOW_MOVING_THRESHOLD_DAYS = 250;
export const DEAD_STOCK_THRESHOLD_DAYS = 365;

export const PRODUCT_ANALYTICS_FILTERS = [
  "low-stock",
  "slow-moving",
  "dead-stock",
] as const;

export type ProductAnalyticsFilter = (typeof PRODUCT_ANALYTICS_FILTERS)[number];
export type ProductMovementFilter = Extract<
  ProductAnalyticsFilter,
  "slow-moving" | "dead-stock"
>;
export type ProductMovementReason =
  | "NEVER_SOLD"
  | "NOT_SOLD_OVER_THRESHOLD";

export type ProductMovementItem = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  lastSoldAt: Date | null;
  daysSinceLastSold: number;
  reason: ProductMovementReason;
};

export const PRODUCT_ANALYTICS_FILTER_LABELS: Record<
  ProductAnalyticsFilter,
  string
> = {
  "low-stock": "Stok Rendah",
  "slow-moving": "Slow Moving",
  "dead-stock": "Dead Stock",
};

export function parseProductAnalyticsFilter(
  value: string | null | undefined,
): ProductAnalyticsFilter | null {
  if (
    value &&
    PRODUCT_ANALYTICS_FILTERS.includes(value as ProductAnalyticsFilter)
  ) {
    return value as ProductAnalyticsFilter;
  }

  return null;
}

export function daysSince(date: Date, now = new Date()) {
  const diff = now.getTime() - date.getTime();

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function cutoffDate(days: number, now: Date) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  return cutoff;
}

function noFinalSaleSince(cutoff: Date): Prisma.ProductWhereInput {
  return {
    NOT: {
      saleItems: {
        some: {
          sale: {
            ...FINAL_SALE_STATUS_WHERE,
            createdAt: {
              gte: cutoff,
            },
          },
        },
      },
    },
  };
}

function reachedNoSaleThreshold(cutoff: Date): Prisma.ProductWhereInput {
  return {
    OR: [
      {
        createdAt: {
          lte: cutoff,
        },
      },
      {
        saleItems: {
          some: {
            sale: {
              ...FINAL_SALE_STATUS_WHERE,
              createdAt: {
                lt: cutoff,
              },
            },
          },
        },
      },
    ],
  };
}

export function getLowStockWhere(): Prisma.ProductWhereInput {
  return {
    stock: {
      lte: prisma.product.fields.minStock,
    },
  };
}

export function getDeadStockWhere({
  now = new Date(),
  thresholdDays = DEAD_STOCK_THRESHOLD_DAYS,
}: {
  now?: Date;
  thresholdDays?: number;
} = {}): Prisma.ProductWhereInput {
  const cutoff = cutoffDate(thresholdDays, now);

  return {
    AND: [
      {
        stock: {
          gt: 0,
        },
      },
      noFinalSaleSince(cutoff),
      reachedNoSaleThreshold(cutoff),
    ],
  };
}

export function getSlowMovingWhere({
  now = new Date(),
}: {
  now?: Date;
} = {}): Prisma.ProductWhereInput {
  const cutoff = cutoffDate(SLOW_MOVING_THRESHOLD_DAYS, now);

  return {
    AND: [
      {
        stock: {
          gt: 0,
        },
      },
      noFinalSaleSince(cutoff),
      reachedNoSaleThreshold(cutoff),
      {
        NOT: getDeadStockWhere({ now }),
      },
    ],
  };
}

export function getProductAnalyticsWhere(
  filter: ProductAnalyticsFilter | null,
  options: {
    now?: Date;
  } = {},
): Prisma.ProductWhereInput | null {
  if (filter === "low-stock") {
    return getLowStockWhere();
  }

  if (filter === "slow-moving") {
    return getSlowMovingWhere(options);
  }

  if (filter === "dead-stock") {
    return getDeadStockWhere(options);
  }

  return null;
}

function movementThresholdDays(filter: ProductMovementFilter) {
  return filter === "dead-stock"
    ? DEAD_STOCK_THRESHOLD_DAYS
    : SLOW_MOVING_THRESHOLD_DAYS;
}

export async function getProductMovementProducts({
  filter,
  limit = 3,
  now = new Date(),
}: {
  filter: ProductMovementFilter;
  limit?: number;
  now?: Date;
}) {
  const where = {
    isActive: true,
    ...getProductAnalyticsWhere(filter, {
      now,
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
    .map((product): ProductMovementItem => {
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

      return b.daysSinceLastSold - a.daysSinceLastSold;
    })
    .slice(0, limit);

  return {
    total,
    thresholdDays: movementThresholdDays(filter),
    items,
  };
}

export async function getProductAnalyticsPreview({
  limit = 3,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}) {
  const [slowMoving, deadStock] = await Promise.all([
    getProductMovementProducts({
      filter: "slow-moving",
      limit,
      now,
    }),
    getProductMovementProducts({
      filter: "dead-stock",
      limit,
      now,
    }),
  ]);

  return {
    slowMoving,
    deadStock,
  };
}
