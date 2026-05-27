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
