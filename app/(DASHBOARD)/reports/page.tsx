import OwnerReportView, {
  type OwnerReportViewData,
} from "@/components/reports/owner-report-view";
import { requireReportsPage } from "@/lib/page-guards";
import {
  LOW_STOCK_LIMIT,
  getOwnerReportSummary,
  getOwnerReportTransactions,
  rupiah,
  type OwnerReportRange,
} from "@/lib/reports";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { serializeProfitSummary } from "@/lib/report-profit-detail";

type ReportsPageProps = {
  searchParams?: Promise<{
    preset?: string;
    from?: string;
    to?: string;
  }>;
};

const paymentColors = ["#10b981", "#3b82f6", "#7c3aed", "#f59e0b", "#64748b"];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);

  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);

  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function parseInputDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatMonthYear(date: Date) {
  return formatDateID(date).slice(3);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function resolveRange(params: Awaited<ReportsPageProps["searchParams"]>) {
  const now = new Date();
  const today = startOfDay(now);
  const preset = params?.preset ?? "today";

  if (preset === "today") {
    return {
      preset,
      from: today,
      to: endOfDay(today),
    };
  }

  if (preset === "this-month" || preset === "month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      preset: "this-month",
      from: monthStart,
      to: endOfDay(today),
    };
  }

  if (preset === "last-month" || preset === "yesterday") {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      preset: "last-month",
      from: monthStart,
      to: endOfDay(monthEnd),
    };
  }

  if (preset === "this-year") {
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);

    return {
      preset,
      from: yearStart,
      to: endOfDay(yearEnd),
    };
  }

  if (preset === "last-year") {
    const yearStart = new Date(today.getFullYear() - 1, 0, 1);
    const yearEnd = new Date(today.getFullYear() - 1, 11, 31);

    return {
      preset,
      from: yearStart,
      to: endOfDay(yearEnd),
    };
  }

  if (preset === "7d") {
    return {
      preset,
      from: addDays(today, -6),
      to: endOfDay(today),
    };
  }

  if (preset === "custom") {
    const fallbackFrom = addDays(today, -29);
    const rawFrom = parseInputDate(params?.from, fallbackFrom);
    const rawTo = parseInputDate(params?.to, today);
    // Clamp future dates to today (safety net against URL tampering)
    const from = rawFrom > today ? today : rawFrom;
    const to = rawTo > today ? today : rawTo;

    return {
      preset,
      from: startOfDay(from),
      to: endOfDay(to < from ? from : to),
    };
  }

  return {
    preset: "30d",
    from: addDays(today, -29),
    to: endOfDay(today),
  };
}

function buildTrend(
  transactions: Awaited<ReturnType<typeof getOwnerReportTransactions>>,
  from: Date,
  to: Date,
) {
  const daySpan = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

  if (daySpan <= 31) {
    // Harian
    const days: { key: string; label: string; omzet: number; transactions: number }[] = [];
    const cursor = startOfDay(from);
    while (cursor <= to) {
      const key = dateInputValue(cursor);
      days.push({ key, label: formatDateID(new Date(cursor)), omzet: 0, transactions: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const sale of transactions) {
      const key = dateInputValue(sale.createdAt);
      const d = map.get(key);
      if (d) { d.omzet += sale.subtotal; d.transactions += 1; }
    }
    return days.length > 0 ? days : [{ label: "-", omzet: 0, transactions: 0 }];
  }

  // Bulanan — untuk periode > 31 hari
  // Label pakai DD/MM/YYYY hari pertama bulan agar groupTrendRowsByMonth bisa parse
  const months: { key: string; label: string; omzet: number; transactions: number }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const toMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= toMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: formatDateID(new Date(cursor)), omzet: 0, transactions: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const map = new Map(months.map((m) => [m.key, m]));
  for (const sale of transactions) {
    const d = sale.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = map.get(key);
    if (m) { m.omzet += sale.subtotal; m.transactions += 1; }
  }
  return months.length > 0 ? months : [{ label: "-", omzet: 0, transactions: 0 }];
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireReportsPage();

  const params = (await searchParams) ?? {};
  const rangeParams = resolveRange(params);
  const range: OwnerReportRange = {
    from: rangeParams.from,
    to: rangeParams.to,
  };
  const [report, transactions] = await Promise.all([
    getOwnerReportSummary(range),
    getOwnerReportTransactions(2000, range),
  ]);
  const grossOmzet = report.month.grossOmzet;
  const customerReturn = report.month.returnValue;
  const netOmzet = report.month.netOmzet;
  const transactionCount = report.month.transactions;
  const paymentTotal = report.month.paymentSummary.reduce(
    (total, item) => total + item.total,
    0,
  );
  const purchaseTotal = report.inventoryReturns.totalPurchaseMonth;
  const supplierReturn = report.inventoryReturns.monthValue;
  const periodLabel = `${formatDateID(rangeParams.from)} - ${formatDateID(rangeParams.to)}`;
  const exportParams = new URLSearchParams({
    preset: rangeParams.preset,
    from: dateInputValue(rangeParams.from),
    to: dateInputValue(rangeParams.to),
  });
  const data: OwnerReportViewData = {
    period: {
      preset: rangeParams.preset,
      from: dateInputValue(rangeParams.from),
      to: dateInputValue(rangeParams.to),
      label: periodLabel,
      updatedAt: formatDateTimeID(new Date()),
    },
    exportHref: `/api/reports/export/pdf?${exportParams.toString()}`,
    kpis: [
      {
        id: "gross",
        title: "Omzet Kotor",
        value: rupiah(grossOmzet),
        helper: "Sebelum retur customer",
        tone: "emerald",
        icon: "chart",
        rows: [
          { label: "Omzet kotor", value: rupiah(grossOmzet), tone: "good" },
          { label: "Total transaksi", value: String(transactionCount) },
          { label: "Periode", value: periodLabel },
        ],
      },
      {
        id: "returns",
        title: "Total Retur",
        value: rupiah(customerReturn),
        helper: `${report.month.returnCount} retur customer`,
        tone: "rose",
        icon: "return",
        rows: [
          { label: "Nilai retur customer", value: rupiah(customerReturn), tone: "danger" },
          { label: "Total retur", value: String(report.month.returnCount) },
          { label: "Alasan terbanyak", value: report.returns.topReason?.label ?? "-" },
        ],
      },
      {
        id: "net",
        title: "Omzet Bersih",
        value: rupiah(netOmzet),
        helper: "Omzet Kotor - Retur Customer",
        tone: "emerald",
        icon: "wallet",
        rows: [
          { label: "Omzet kotor", value: rupiah(grossOmzet) },
          { label: "Retur customer", value: rupiah(customerReturn), tone: "danger" },
          { label: "Omzet bersih", value: rupiah(netOmzet), tone: "good" },
        ],
      },
      {
        id: "transactions",
        title: "Total Transaksi",
        value: String(transactionCount),
        helper: "Transaksi selesai",
        tone: "blue",
        icon: "transaction",
        rows: [
          { label: "Total transaksi", value: String(transactionCount) },
          { label: "Payment tercatat", value: String(report.month.paymentSummary.length) },
          { label: "Periode", value: periodLabel },
        ],
      },
      {
        id: "atv",
        title: "ATV",
        value: rupiah(report.month.averageTransaction),
        helper: "Avg. transaksi",
        tone: "violet",
        icon: "atv",
        rows: [
          { label: "Omzet kotor", value: rupiah(grossOmzet) },
          { label: "Total transaksi", value: String(transactionCount) },
          { label: "ATV", value: rupiah(report.month.averageTransaction), tone: "good" },
        ],
      },
      {
        id: "products-sold",
        title: "Produk Terjual",
        value: "-",
        helper: "Data total qty belum tersedia",
        tone: "amber",
        icon: "purchase",
        rows: [
          { label: "Produk terlaris tercatat", value: String(report.bestSellers.length) },
          { label: "Catatan", value: "Total qty belum tersedia dari payload laporan" },
        ],
      },
      {
        id: "purchase",
        title: "Total Pembelian",
        value: rupiah(purchaseTotal),
        helper: "Pembelian periode",
        tone: "amber",
        icon: "purchase",
        rows: [
          { label: "Total pembelian", value: rupiah(purchaseTotal) },
          { label: "Retur supplier", value: rupiah(supplierReturn) },
          { label: "Net pembelian", value: rupiah(report.inventoryReturns.netPurchaseMonth) },
        ],
      },
      ...(report.profit.hasUnitCostSnapshot
        ? [
            {
              id: "profit",
              title: "Laba Kotor",
              value: rupiah(report.profit.netProfit),
              helper: `Margin ${formatPercent(report.profit.marginPercent)}`,
              tone: "emerald" as const,
              icon: "profit" as const,
              rows: [
                { label: "Omzet bersih", value: rupiah(report.profit.netRevenue), tone: "good" as const },
                { label: "HPP bersih", value: rupiah(report.profit.netCogs) },
                { label: "Laba kotor", value: rupiah(report.profit.netProfit), tone: "good" as const },
                { label: "Margin", value: formatPercent(report.profit.marginPercent) },
              ],
            },
          ]
        : []),
    ],
    payments: report.month.paymentSummary.map((item, index) => ({
      method: item.paymentMethod,
      label: item.paymentLabel,
      total: item.total,
      formattedTotal: rupiah(item.total),
      transactions: item.transactions,
      percent: paymentTotal > 0 ? (item.total / paymentTotal) * 100 : 0,
      color: paymentColors[index % paymentColors.length],
    })),
    paymentTotal: rupiah(paymentTotal),
    reconciliation: {
      netOmzet: rupiah(netOmzet),
      totalPayment: rupiah(paymentTotal),
      difference: paymentTotal - netOmzet,
      differenceLabel: rupiah(paymentTotal - netOmzet),
    },
    bestSellers: report.bestSellers.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      qty: item.qty,
      total: item.total,
      formattedTotal: rupiah(item.total),
      stock: item.stock,
    })),
    returnSummary: {
      count: report.month.returnCount,
      value: rupiah(customerReturn),
      rawValue: customerReturn,
      topReason: report.returns.topReason?.label ?? "-",
      supplierCount: report.inventoryReturns.monthCount,
      supplierValue: rupiah(supplierReturn),
      supplierRawValue: supplierReturn,
      reasons: report.returns.reasonSummary.map((item) => ({
        reason: item.reason,
        label: item.label,
        returns: item.returns,
        formattedTotal: rupiah(item.total),
      })),
      recentCustomer: report.returns.recent.map((item) => ({
        id: item.id,
        number: item.sale.invoiceNumber,
        date: formatDateID(item.createdAt),
        reason: item.reasonLabel,
        total: rupiah(item.totalRefund ?? 0),
      })),
      recentSupplier: report.inventoryReturns.recent.map((item) => ({
        id: item.id,
        number: item.returnNumber,
        date: formatDateID(item.createdAt),
        supplier: item.supplier.name,
        supplierType: item.supplier.type,
        reason: item.reason,
        total: rupiah(item.totalAmount ?? 0),
      })),
    },
    lowStock: report.lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku ?? "-",
      stock: product.stock,
      minimumStock: LOW_STOCK_LIMIT,
    })),
    recentPurchases: report.recentPurchases.map((purchase) => ({
      id: purchase.id,
      number: purchase.purchaseNumber,
      date: formatDateID(purchase.createdAt),
      supplier: purchase.supplier.name,
      itemCount: purchase.items.length,
      totalQty: purchase.items.reduce((total, item) => total + item.qty, 0),
      total: rupiah(purchase.total ?? 0),
      createdBy: purchase.user?.name ?? null,
      notes: purchase.notes ?? null,
      items: purchase.items.map((item) => {
        const movement = item.stockMovements[0];

        return {
          id: item.id,
          product: item.product.name,
          sku: item.product.sku ?? "-",
          category: item.product.category ?? null,
          qty: item.qty,
          costPrice: rupiah(item.costPrice),
          subtotal: rupiah(item.subtotal),
          stockBefore: movement?.stockBefore ?? null,
          stockAfter: movement?.stockAfter ?? null,
          notes: movement?.notes ?? null,
        };
      }),
    })),
    profitSummary: serializeProfitSummary(report.profit),
    monthlySummary: {
      title: `Ringkasan Bulanan (${formatMonthYear(rangeParams.from)})`,
      items: [
        { label: "Omzet Kotor", value: rupiah(grossOmzet), tone: "emerald" },
        { label: "Omzet Bersih", value: rupiah(netOmzet), tone: "emerald" },
        { label: "Total Transaksi", value: String(transactionCount), tone: "blue" },
        { label: "ATV", value: rupiah(report.month.averageTransaction), tone: "violet" },
        { label: "Retur", value: rupiah(customerReturn), tone: "rose" },
        { label: "Total Pembelian", value: rupiah(purchaseTotal), tone: "amber" },
      ],
    },
    transactions: transactions.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      createdAt: sale.createdAt.toISOString(),
      createdAtLabel: formatDateTimeID(sale.createdAt),
      cashierName: sale.cashier.name,
      cashierRoleName: sale.cashier.role?.name ?? null,
      cashierRoleSlug: sale.cashier.role?.slug ?? null,
      customerName: sale.customer?.name ?? "Walk-in",
      paymentMethod: sale.paymentMethod,
      paymentLabel: sale.paymentLabel,
      transactionStatus: sale.transactionStatus,
      paymentStatus: sale.paymentStatus,
      subtotal: sale.subtotal,
      formattedSubtotal: rupiah(sale.subtotal),
      itemCount: sale._count.items,
      returnCount: sale._count.returns,
    })),
    trend: buildTrend(transactions, rangeParams.from, rangeParams.to),
    cashiers: Array.from(new Set(transactions.map((sale) => sale.cashier.name))),
    paymentMethods: Array.from(
      new Set(transactions.map((sale) => sale.paymentMethod)),
    ),
  };

  return <OwnerReportView data={data} />;
}
