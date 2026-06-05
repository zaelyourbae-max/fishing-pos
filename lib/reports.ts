import { prisma } from "@/lib/prisma";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
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
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
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

function finalSaleWhere(range?: OwnerReportRange, fallbackStart?: Date) {
  return {
    ...createdAtRange(range, fallbackStart),
    ...FINAL_SALE_STATUS_WHERE,
  };
}

export async function getOwnerReportTransactions(
  take = 200,
  range?: OwnerReportRange,
) {
  // Batas atas dinaikkan ke 5000: halaman Laporan Owner meminta 2000 (untuk
  // tabel transaksi + grafik tren 7 hari). Sebelumnya dipaksa 200 sehingga di
  // toko ramai grafik & daftar terpotong diam-diam. Default tetap 200 untuk
  // pemanggil lain (ekspor PDF/Excel) yang sengaja minta sedikit.
  const safeTake = Math.min(Math.max(take, 1), 5000);
  const where = finalSaleWhere(range, startOfMonth());

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
        transactionStatus: true,
        paymentStatus: true,
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
      sale: FINAL_SALE_STATUS_WHERE,
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
              role: {
                select: {
                  name: true,
                  slug: true,
                },
              },
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

function marginPercent(profit: number, revenue: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

function moneyNumber(amount: unknown) {
  return Math.round(Number(amount ?? 0));
}

export async function getOwnerReportSummary(range?: OwnerReportRange) {
  return getOwnerReportSummaryForRange(range);
}

export async function getOwnerReportSummaryForRange(range?: OwnerReportRange) {
  const todayStart = startOfToday();
  const monthStart = startOfMonth();
  const activeRange = createdAtRange(range, monthStart);
  const todayRange = createdAtRange(undefined, todayStart);
  const activeSaleWhere = finalSaleWhere(range, monthStart);
  const todaySaleWhere = finalSaleWhere(undefined, todayStart);
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
    profitSaleItems,
    profitReturnItems,
    expenseSummary,
  ] = await Promise.all([
    getSettings(),
    prisma.sale.aggregate({
      where: todaySaleWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.aggregate({
      where: activeSaleWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: todaySaleWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: activeSaleWhere,
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
        sale: activeSaleWhere,
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
      take: 200,
      select: {
        id: true,
        purchaseNumber: true,
        total: true,
        notes: true,
        createdAt: true,
        supplier: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            qty: true,
            costPrice: true,
            subtotal: true,
            product: {
              select: {
                name: true,
                sku: true,
                category: true,
              },
            },
            stockMovements: {
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
              select: {
                stockBefore: true,
                stockAfter: true,
                notes: true,
              },
            },
          },
        },
      },
    }),
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        ...todayRange,
        sale: FINAL_SALE_STATUS_WHERE,
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
        sale: FINAL_SALE_STATUS_WHERE,
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
        sale: FINAL_SALE_STATUS_WHERE,
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
        sale: FINAL_SALE_STATUS_WHERE,
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
    prisma.saleItem.findMany({
      where: {
        sale: activeSaleWhere,
      },
      select: {
        productId: true,
        qty: true,
        subtotal: true,
        subtotalAfterDiscount: true,
        unitCost: true,
        product: {
          select: {
            name: true,
            sku: true,
            category: true,
          },
        },
        sale: {
          select: {
            invoiceNumber: true,
            createdAt: true,
            paymentMethod: true,
          },
        },
      },
    }),
    prisma.saleReturnItem.findMany({
      where: {
        saleReturn: {
          returnType: "CUSTOMER_RETURN",
          ...activeRange,
          sale: FINAL_SALE_STATUS_WHERE,
        },
      },
      select: {
        productId: true,
        qty: true,
        subtotal: true,
        unitCost: true,
        product: {
          select: {
            name: true,
            sku: true,
            category: true,
          },
        },
        saleReturn: {
          select: {
            reason: true,
            createdAt: true,
            sale: {
              select: {
                invoiceNumber: true,
                paymentMethod: true,
              },
            },
          },
        },
      },
    }),
    prisma.expense.aggregate({
      where: {
        date: {
          gte: range?.from ?? monthStart,
          lte: range?.to ?? new Date(),
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
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
  const salesCogs = profitSaleItems.reduce(
    (total, item) => total + item.qty * item.unitCost,
    0,
  );
  const returnCogs = profitReturnItems.reduce(
    (total, item) => total + item.qty * item.unitCost,
    0,
  );
  const netCogs = Math.max(salesCogs - returnCogs, 0);
  const profitByProduct = new Map<
    number,
    {
      productId: number;
      name: string;
      sku: string;
      category: string | null;
      soldQty: number;
      returnQty: number;
      qty: number;
      grossRevenue: number;
      returnRevenue: number;
      revenue: number;
      salesCogs: number;
      returnCogs: number;
      cogs: number;
      profit: number;
      missingSalesCost: boolean;
      missingReturnCost: boolean;
      sales: {
        invoiceNumber: string;
        createdAt: Date;
        qty: number;
        revenue: number;
        cogs: number;
        profit: number;
        paymentMethod: string;
      }[];
      returns: {
        invoiceNumber: string;
        createdAt: Date;
        qty: number;
        revenue: number;
        cogs: number;
        reason: string;
        paymentMethod: string;
      }[];
    }
  >();

  for (const item of profitSaleItems) {
    const itemRevenue = moneyNumber(item.subtotalAfterDiscount) || item.subtotal;
    const current = profitByProduct.get(item.productId) ?? {
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku ?? "-",
      category: item.product.category,
      soldQty: 0,
      returnQty: 0,
      qty: 0,
      grossRevenue: 0,
      returnRevenue: 0,
      revenue: 0,
      salesCogs: 0,
      returnCogs: 0,
      cogs: 0,
      profit: 0,
      missingSalesCost: false,
      missingReturnCost: false,
      sales: [],
      returns: [],
    };

    const itemCogs = item.qty * item.unitCost;

    current.soldQty += item.qty;
    current.qty = current.soldQty - current.returnQty;
    current.grossRevenue += itemRevenue;
    current.revenue = current.grossRevenue - current.returnRevenue;
    current.salesCogs += itemCogs;
    current.cogs = current.salesCogs - current.returnCogs;
    current.profit = current.revenue - current.cogs;
    current.missingSalesCost = current.missingSalesCost || item.unitCost <= 0;
    current.sales.push({
      invoiceNumber: item.sale.invoiceNumber,
      createdAt: item.sale.createdAt,
      qty: item.qty,
      revenue: itemRevenue,
      cogs: itemCogs,
      profit: itemRevenue - itemCogs,
      paymentMethod: item.sale.paymentMethod,
    });
    profitByProduct.set(item.productId, current);
  }

  for (const item of profitReturnItems) {
    const productId = item.productId;
    const current = profitByProduct.get(productId) ?? {
      productId,
      name: item.product.name,
      sku: item.product.sku ?? "-",
      category: item.product.category,
      soldQty: 0,
      returnQty: 0,
      qty: 0,
      grossRevenue: 0,
      returnRevenue: 0,
      revenue: 0,
      salesCogs: 0,
      returnCogs: 0,
      cogs: 0,
      profit: 0,
      missingSalesCost: false,
      missingReturnCost: false,
      sales: [],
      returns: [],
    };

    const itemCogs = item.qty * item.unitCost;

    current.returnQty += item.qty;
    current.qty = current.soldQty - current.returnQty;
    current.returnRevenue += item.subtotal;
    current.revenue = current.grossRevenue - current.returnRevenue;
    current.returnCogs += itemCogs;
    current.cogs = current.salesCogs - current.returnCogs;
    current.profit = current.revenue - current.cogs;
    current.missingReturnCost = current.missingReturnCost || item.unitCost <= 0;
    current.returns.push({
      invoiceNumber: item.saleReturn.sale.invoiceNumber,
      createdAt: item.saleReturn.createdAt,
      qty: item.qty,
      revenue: item.subtotal,
      cogs: itemCogs,
      reason: item.saleReturn.reason,
      paymentMethod: item.saleReturn.sale.paymentMethod,
    });
    profitByProduct.set(productId, current);
  }

  const netRevenue = Math.max((monthSales._sum.subtotal ?? 0) - monthReturnValue, 0);
  const grossProfit = netRevenue - netCogs;
  const operatingExpenses = expenseSummary._sum.amount ?? 0;
  const netProfitAfterExpenses = grossProfit - operatingExpenses;
  const hasUnitCostSnapshot = profitSaleItems.some((item) => item.unitCost > 0);
  const incompleteReturnCostCount = profitReturnItems.filter(
    (item) => item.qty > 0 && item.unitCost <= 0,
  ).length;
  const hasIncompleteReturnCost = incompleteReturnCostCount > 0;

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
    profit: {
      hasUnitCostSnapshot,
      grossRevenue: monthSales._sum.subtotal ?? 0,
      returnRevenue: monthReturnValue,
      netRevenue,
      salesCogs,
      returnCogs,
      netCogs,
      grossProfit,
      netProfit: grossProfit,
      operatingExpenses,
      netProfitAfterExpenses,
      netMarginPercent: marginPercent(netProfitAfterExpenses, netRevenue),
      hasIncompleteReturnCost,
      incompleteReturnCostCount,
      marginPercent: marginPercent(
        grossProfit,
        netRevenue,
      ),
      productBreakdown: Array.from(profitByProduct.values())
        .sort((a, b) => b.profit - a.profit)
        .map((item) => ({
          ...item,
          marginPercent: marginPercent(item.profit, item.revenue),
        })),
      topProducts: Array.from(profitByProduct.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5)
        .map((item) => ({
          ...item,
          marginPercent: marginPercent(item.profit, item.revenue),
        })),
    },
    expenses: {
      total: expenseSummary._sum.amount ?? 0,
      count: expenseSummary._count._all,
    },
  };
}

export type MonthlyComparisonMetric = {
  key: string;
  label: string;
  /** Nilai bulan ini (sampai tanggal berjalan). */
  current: number;
  /** Nilai bulan lalu (periode tanggal yang sama). */
  previous: number;
  /** Persentase perubahan vs bulan lalu (null bila bulan lalu 0). */
  changePercent: number | null;
  /** Untuk metrik uang yang ditampilkan rupiah. */
  isCurrency: boolean;
  /** true: naik = bagus (omzet). false: naik = buruk (retur, pengeluaran). */
  goodWhenUp: boolean;
};

export type MonthlyComparison = {
  thisMonthLabel: string;
  lastMonthLabel: string;
  /** Tanggal batas (s/d tgl berapa) supaya perbandingan adil. */
  cutoffDay: number;
  metrics: MonthlyComparisonMetric[];
};

/**
 * Perbandingan "bulan ini vs bulan lalu" untuk Ringkasan Bulanan di Laporan Owner.
 * Adil: bulan ini dihitung sampai tanggal berjalan, bulan lalu sampai tanggal
 * yang sama (mis. 1-15 vs 1-15), supaya tidak membandingkan bulan penuh dengan
 * bulan yang belum selesai. Selalu kalender (lepas dari filter periode laporan).
 */
export async function getMonthlyComparison(): Promise<MonthlyComparison> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();

  const thisStart = new Date(year, month, 1, 0, 0, 0, 0);
  const thisEnd = now;

  // Batas hari di bulan lalu, dijaga tidak melebihi jumlah hari bulan lalu.
  const lastDayPrevMonth = new Date(year, month, 0).getDate();
  const prevCutoffDay = Math.min(dayOfMonth, lastDayPrevMonth);
  const prevStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const prevEnd = new Date(year, month - 1, prevCutoffDay, 23, 59, 59, 999);

  async function metricsFor(gte: Date, lte: Date) {
    const [sales, returns, purchases, expenses] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte, lte }, ...FINAL_SALE_STATUS_WHERE },
        _sum: { subtotal: true },
        _count: { _all: true },
      }),
      prisma.saleReturn.aggregate({
        where: {
          returnType: "CUSTOMER_RETURN",
          createdAt: { gte, lte },
          sale: FINAL_SALE_STATUS_WHERE,
        },
        _sum: { totalRefund: true },
      }),
      prisma.purchase.aggregate({
        where: { createdAt: { gte, lte } },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte, lte } },
        _sum: { amount: true },
      }),
    ]);

    const gross = sales._sum.subtotal ?? 0;
    const returnValue = returns._sum.totalRefund ?? 0;
    const transactions = sales._count._all;

    return {
      gross,
      net: Math.max(gross - returnValue, 0),
      transactions,
      atv: transactions > 0 ? Math.round(gross / transactions) : 0,
      returnValue,
      purchase: purchases._sum.total ?? 0,
      expense: expenses._sum.amount ?? 0,
    };
  }

  const [current, previous] = await Promise.all([
    metricsFor(thisStart, thisEnd),
    metricsFor(prevStart, prevEnd),
  ]);

  function changePercent(now: number, before: number): number | null {
    if (before === 0) {
      return null;
    }

    return Math.round(((now - before) / before) * 100);
  }

  const metrics: MonthlyComparisonMetric[] = [
    { key: "gross", label: "Omzet Kotor", isCurrency: true, goodWhenUp: true,
      current: current.gross, previous: previous.gross,
      changePercent: changePercent(current.gross, previous.gross) },
    { key: "net", label: "Omzet Bersih", isCurrency: true, goodWhenUp: true,
      current: current.net, previous: previous.net,
      changePercent: changePercent(current.net, previous.net) },
    { key: "transactions", label: "Total Transaksi", isCurrency: false, goodWhenUp: true,
      current: current.transactions, previous: previous.transactions,
      changePercent: changePercent(current.transactions, previous.transactions) },
    { key: "atv", label: "ATV", isCurrency: true, goodWhenUp: true,
      current: current.atv, previous: previous.atv,
      changePercent: changePercent(current.atv, previous.atv) },
    { key: "return", label: "Retur", isCurrency: true, goodWhenUp: false,
      current: current.returnValue, previous: previous.returnValue,
      changePercent: changePercent(current.returnValue, previous.returnValue) },
    { key: "purchase", label: "Total Pembelian", isCurrency: true, goodWhenUp: false,
      current: current.purchase, previous: previous.purchase,
      changePercent: changePercent(current.purchase, previous.purchase) },
    { key: "expense", label: "Pengeluaran Ops", isCurrency: true, goodWhenUp: false,
      current: current.expense, previous: previous.expense,
      changePercent: changePercent(current.expense, previous.expense) },
  ];

  const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });

  return {
    thisMonthLabel: monthFmt.format(thisStart),
    lastMonthLabel: monthFmt.format(prevStart),
    cutoffDay: dayOfMonth,
    metrics,
  };
}
