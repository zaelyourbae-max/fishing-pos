import { prisma } from "@/lib/prisma";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { getSettings } from "@/lib/settings";

export const LOW_STOCK_LIMIT = 10;

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

export function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function reportDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export type OwnerReportRange = {
  from?: Date;
  to?: Date;
  label?: string;
};

function createdAtRange(range?: OwnerReportRange, fallbackStart?: Date) {
  const createdAt: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (range?.from) {
    createdAt.gte = range.from;
  } else if (fallbackStart) {
    createdAt.gte = fallbackStart;
  }

  if (range?.to) {
    createdAt.lte = range.to;
  }

  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

export async function getOwnerReportTransactions(
  take = 200,
  range?: OwnerReportRange,
) {
  const safeTake = Math.min(Math.max(take, 1), 200);
  const where = createdAtRange(range, startOfMonth());

  const [sales, paymentMethods] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: safeTake,
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        subtotal: true,
        paidAmount: true,
        paymentMethod: true,
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
        _count: {
          select: {
            items: true,
            returns: true,
          },
        },
      },
    }),
    prisma.paymentMethod.findMany({
      select: {
        code: true,
        name: true,
      },
    }),
  ]);
  const paymentMethodMap = new Map(
    paymentMethods.map((method) => [method.code, method.name]),
  );

  return sales.map((sale) => ({
    ...sale,
    paymentLabel: paymentMethodMap.get(sale.paymentMethod) ?? sale.paymentMethod,
  }));
}

export async function getOwnerReportReturns(take = 200, range?: OwnerReportRange) {
  const safeTake = Math.min(Math.max(take, 1), 200);

  return prisma.saleReturn.findMany({
    where: {
      returnType: "CUSTOMER_RETURN",
      ...createdAtRange(range, startOfMonth()),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: safeTake,
    select: {
      id: true,
      reason: true,
      notes: true,
      totalRefund: true,
      createdAt: true,
      sale: {
        select: {
          invoiceNumber: true,
          cashier: {
            select: {
              name: true,
            },
          },
        },
      },
      items: {
        select: {
          qty: true,
          subtotal: true,
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
      },
    },
  });
}

function reasonLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
}

export async function getOwnerReportSummary(range?: OwnerReportRange) {
  return getOwnerReportSummaryForRange(range);
}

export async function getOwnerReportSummaryForRange(range?: OwnerReportRange) {
  const todayStart = startOfToday();
  const monthStart = startOfMonth();
  const activeRange = createdAtRange(range, monthStart);
  const todayRange = createdAtRange(undefined, todayStart);
  const [
    settings,
    todaySales,
    monthSales,
    paymentToday,
    paymentMonth,
    bestSellerGroups,
    lowStockProducts,
    recentPurchases,
    todayReturns,
    monthReturns,
    returnReasonGroups,
    recentReturns,
    todaySupplierReturns,
    monthSupplierReturns,
    monthPurchases,
    recentSupplierReturns,
    paymentMethods,
  ] = await Promise.all([
    getSettings(),
    prisma.sale.aggregate({
      where: todayRange,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.aggregate({
      where: activeRange,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: todayRange,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: activeRange,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: {
        sale: activeRange,
      },
      _sum: {
        qty: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          qty: "desc",
        },
      },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        stock: {
          lt: LOW_STOCK_LIMIT,
        },
      },
      orderBy: {
        stock: "asc",
      },
      take: 8,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
      },
    }),
    prisma.purchase.findMany({
      where: activeRange,
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        purchaseNumber: true,
        total: true,
        createdAt: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        ...todayRange,
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        ...activeRange,
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.saleReturn.groupBy({
      by: ["reason"],
      where: {
        returnType: "CUSTOMER_RETURN",
        ...activeRange,
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.saleReturn.findMany({
      where: {
        returnType: "CUSTOMER_RETURN",
        ...activeRange,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        reason: true,
        notes: true,
        totalRefund: true,
        createdAt: true,
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
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
      },
    }),
    prisma.supplierReturn.aggregate({
      where: todayRange,
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.supplierReturn.aggregate({
      where: activeRange,
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.purchase.aggregate({
      where: activeRange,
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.supplierReturn.findMany({
      where: activeRange,
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        returnNumber: true,
        reason: true,
        totalAmount: true,
        createdAt: true,
        supplier: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    }),
    prisma.paymentMethod.findMany({
      select: {
        code: true,
        name: true,
      },
    }),
  ]);
  const productIds = bestSellerGroups.map((item) => item.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
        },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const paymentMethodMap = new Map(
    paymentMethods.map((method) => [method.code, method.name]),
  );
  const todayReturnValue = todayReturns._sum.totalRefund ?? 0;
  const monthReturnValue = monthReturns._sum.totalRefund ?? 0;
  const todaySupplierReturnValue = todaySupplierReturns._sum.totalAmount ?? 0;
  const monthSupplierReturnValue = monthSupplierReturns._sum.totalAmount ?? 0;
  const monthPurchaseValue = monthPurchases._sum.total ?? 0;
  const returnReasonSummary = returnReasonGroups
    .map((item) => ({
      reason: item.reason,
      label: reasonLabel(item.reason),
      returns: item._count._all,
      total: item._sum.totalRefund ?? 0,
    }))
    .sort((a, b) => b.returns - a.returns || b.total - a.total);

  return {
    settings,
    today: {
      omzet: todaySales._sum.subtotal ?? 0,
      grossOmzet: todaySales._sum.subtotal ?? 0,
      returnCount: todayReturns._count._all,
      returnValue: todayReturnValue,
      netOmzet: Math.max((todaySales._sum.subtotal ?? 0) - todayReturnValue, 0),
      transactions: todaySales._count._all,
      averageTransaction:
        todaySales._count._all > 0
          ? Math.round((todaySales._sum.subtotal ?? 0) / todaySales._count._all)
          : 0,
      paymentSummary: paymentToday.map((item) => ({
        paymentMethod: item.paymentMethod,
        paymentLabel: paymentMethodMap.get(item.paymentMethod) ?? item.paymentMethod,
        total: item._sum.subtotal ?? 0,
        transactions: item._count._all,
      })),
    },
    month: {
      omzet: monthSales._sum.subtotal ?? 0,
      grossOmzet: monthSales._sum.subtotal ?? 0,
      returnCount: monthReturns._count._all,
      returnValue: monthReturnValue,
      netOmzet: Math.max((monthSales._sum.subtotal ?? 0) - monthReturnValue, 0),
      transactions: monthSales._count._all,
      averageTransaction:
        monthSales._count._all > 0
          ? Math.round((monthSales._sum.subtotal ?? 0) / monthSales._count._all)
          : 0,
      paymentSummary: paymentMonth.map((item) => ({
        paymentMethod: item.paymentMethod,
        paymentLabel: paymentMethodMap.get(item.paymentMethod) ?? item.paymentMethod,
        total: item._sum.subtotal ?? 0,
        transactions: item._count._all,
      })),
    },
    bestSellers: bestSellerGroups.map((item) => {
      const product = productMap.get(item.productId);

      return {
        productId: item.productId,
        name: product?.name ?? "Produk tidak ditemukan",
        sku: product?.sku ?? "-",
        stock: product?.stock ?? 0,
        qty: item._sum.qty ?? 0,
        total: item._sum.subtotal ?? 0,
      };
    }),
    lowStockProducts,
    recentPurchases,
    returns: {
      reasonSummary: returnReasonSummary,
      topReason: returnReasonSummary[0] ?? null,
      recent: recentReturns.map((item) => ({
        ...item,
        reasonLabel: reasonLabel(item.reason),
      })),
    },
    inventoryReturns: {
      todayCount: todaySupplierReturns._count._all,
      todayValue: todaySupplierReturnValue,
      monthCount: monthSupplierReturns._count._all,
      monthValue: monthSupplierReturnValue,
      totalPurchaseMonth: monthPurchaseValue,
      netPurchaseMonth: Math.max(monthPurchaseValue - monthSupplierReturnValue, 0),
      recent: recentSupplierReturns,
    },
  };
}
