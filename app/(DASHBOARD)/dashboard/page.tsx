import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  ClipboardList,
  LineChart,
  Package,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import DashboardTopActions, {
  DashboardStatusChips,
} from "@/components/dashboard/dashboard-top-actions";
import KpiActionCard, {
  type KpiDetail,
  type KpiIconName,
} from "@/components/dashboard/kpi-action-card";
import OperationalAlerts, {
  type OperationalAlert,
} from "@/components/dashboard/operational-alerts";
import ProductAnalyticsCard, {
  type ProductAnalyticsCardItem,
} from "@/components/dashboard/product-analytics-card";
import TransactionPaymentPanel from "@/components/dashboard/transaction-payment-panel";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { requireOwnerPage } from "@/lib/page-guards";
import {
  getLowStockWhere,
  getProductAnalyticsPreview,
} from "@/lib/product-analytics";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/reports";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { getSettings } from "@/lib/settings";
import { transactionIdentityLabel } from "@/lib/transaction-identity";

type DashboardPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

type StatTone = "emerald" | "blue" | "violet" | "amber" | "rose";

const toneClass: Record<StatTone, string> = {
  emerald: "bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const paymentColors = ["#10b981", "#3b82f6", "#7c3aed", "#64748b", "#f59e0b"];
const DASHBOARD_TOP_PRODUCTS_LIMIT = 5;
const DASHBOARD_ALERT_LIMIT = 3;
const DASHBOARD_PRODUCT_ANALYTICS_LIMIT = 3;

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function parseSelectedDate(value?: string) {
  if (!value) {
    return new Date();
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

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

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);

  return next;
}

function previousDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() - 1);

  return next;
}

function previousMonthStart(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() - 1, 1);
  next.setHours(0, 0, 0, 0);

  return next;
}

function previousMonthEnd(date: Date) {
  const next = new Date(date);
  next.setDate(0);
  next.setHours(23, 59, 59, 999);

  return next;
}

function formatDate(date: Date) {
  return formatDateID(date);
}

function formatHeaderDate(date: Date) {
  return formatDateTimeID(date);
}

function formatMonthYear(date: Date) {
  return formatDateID(date).slice(3);
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function reasonLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
}

function trendLabel(current: number, previous: number, period: string) {
  const suffix = period ? ` ${period}` : "";

  if (previous === 0) {
    return {
      text: current > 0 ? `Baru${suffix}` : `0%${suffix}`,
      positive: current >= previous,
    };
  }

  const percentage = Math.round(((current - previous) / previous) * 100);

  return {
    text: `${Math.abs(percentage)}%${suffix}`,
    positive: percentage >= 0,
  };
}

function salesHref(date: string, extra?: string) {
  const params = new URLSearchParams({
    from: date,
    to: date,
  });

  if (extra) {
    params.set("payment", extra);
  }

  return `/sales?${params.toString()}`;
}

function SectionHeader({
  title,
  href,
  action = "Lihat semua",
}: {
  title: string;
  href: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="min-w-0 flex-1 break-words text-lg font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold text-teal-700 transition duration-200 hover:bg-teal-50 hover:text-teal-600 active:scale-95 dark:text-teal-300 dark:hover:bg-teal-500/10"
      >
        {action}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// Kept temporarily so the previous card markup remains easy to compare while
// KPI interactions move to the client card below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatCard({
  title,
  value,
  helper,
  trend,
  icon: Icon,
  tone,
  href,
}: {
  title: string;
  value: string;
  helper: string;
  trend?: {
    text: string;
    positive: boolean;
  };
  icon: LucideIcon;
  tone: StatTone;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70"
    >
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneClass[tone]}`}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className="mt-1 block text-xl font-bold text-slate-950 dark:text-white">
          {value}
        </span>
        <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {trend ? (
            <span
              className={
                trend.positive
                  ? "mr-1 text-teal-600 dark:text-teal-300"
                  : "mr-1 text-rose-600 dark:text-rose-300"
              }
            >
              {trend.positive ? "▲" : "▼"} {trend.text}
            </span>
          ) : null}
          {helper}
        </span>
      </span>
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  label,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  helper?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </p>
      {helper ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function ProductThumb({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      <span
        className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-cover bg-center dark:border-slate-800"
        style={{ backgroundImage: `url("${imageUrl}")` }}
        aria-label={name}
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200">
      <Package className="h-5 w-5" />
    </span>
  );
}

function MiniMetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: StatTone;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-100 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 sm:items-center sm:gap-3 sm:p-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${toneClass[tone]}`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className="mt-1 block whitespace-nowrap text-[13px] font-extrabold tabular-nums text-slate-950 dark:text-white sm:text-base xl:text-lg">
          {value}
        </span>
        <span className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </span>
      </span>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const selectedDate = parseSelectedDate(params.date);
  const selectedDateInput = dateInputValue(selectedDate);
  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);
  const priorDay = previousDay(selectedDate);
  const priorDayStart = startOfDay(priorDay);
  const priorDayEnd = endOfDay(priorDay);
  const monthStart = startOfMonth(selectedDate);
  const previousMonthFrom = previousMonthStart(selectedDate);
  const previousMonthTo = previousMonthEnd(selectedDate);
  const saleDayWhere = {
    createdAt: {
      gte: dayStart,
      lte: dayEnd,
    },
    ...FINAL_SALE_STATUS_WHERE,
  };
  const saleMonthWhere = {
    createdAt: {
      gte: monthStart,
      lte: dayEnd,
    },
    ...FINAL_SALE_STATUS_WHERE,
  };
  const [
    salesToday,
    salesYesterday,
    salesMonth,
    salesPrevMonth,
    returnsToday,
    returnsMonth,
    returnsPrevMonth,
    supplierReturnsToday,
    supplierReturnsMonth,
    purchasesMonth,
    productsActive,
    lowStockProducts,
    recentSales,
    bestSellerGroups,
    paymentTodaySummary,
    returnReasonGroups,
    todaySalesQuick,
    todayReturnsQuick,
    activeProductSamples,
    productAnalytics,
    settings,
    currentUser,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: saleDayWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        createdAt: {
          gte: priorDayStart,
          lte: priorDayEnd,
        },
        ...FINAL_SALE_STATUS_WHERE,
      },
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.aggregate({
      where: saleMonthWhere,
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        createdAt: {
          gte: previousMonthFrom,
          lte: previousMonthTo,
        },
        ...FINAL_SALE_STATUS_WHERE,
      },
      _sum: {
        subtotal: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.saleReturn.aggregate({
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
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        sale: FINAL_SALE_STATUS_WHERE,
        createdAt: {
          gte: monthStart,
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
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        sale: FINAL_SALE_STATUS_WHERE,
        createdAt: {
          gte: previousMonthFrom,
          lte: previousMonthTo,
        },
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.supplierReturn.aggregate({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.supplierReturn.aggregate({
      where: {
        createdAt: {
          gte: monthStart,
          lte: dayEnd,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.purchase.aggregate({
      where: {
        createdAt: {
          gte: monthStart,
          lte: dayEnd,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.product.count({
      where: {
        isActive: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        ...getLowStockWhere(),
      },
      orderBy: {
        stock: "asc",
      },
      take: 5,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        imageUrl: true,
      },
    }),
    prisma.sale.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: DASHBOARD_TOP_PRODUCTS_LIMIT,
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        paymentMethod: true,
        transactionStatus: true,
        paymentStatus: true,
        createdAt: true,
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
        items: {
          select: {
            qty: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
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
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: {
        sale: saleDayWhere,
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
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: saleDayWhere,
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
      take: 5,
    }),
    prisma.saleReturn.groupBy({
      by: ["reason"],
      where: {
        returnType: "CUSTOMER_RETURN",
        sale: FINAL_SALE_STATUS_WHERE,
        createdAt: {
          gte: monthStart,
          lte: dayEnd,
        },
      },
      _sum: {
        totalRefund: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          totalRefund: "desc",
        },
      },
      take: 5,
    }),
    prisma.sale.findMany({
      where: saleDayWhere,
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        paymentMethod: true,
        transactionStatus: true,
        paymentStatus: true,
        createdAt: true,
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
    prisma.saleReturn.findMany({
      where: {
        returnType: "CUSTOMER_RETURN",
        sale: FINAL_SALE_STATUS_WHERE,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        reason: true,
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
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 6,
      select: {
        name: true,
        sku: true,
        stock: true,
        category: true,
      },
    }),
    getProductAnalyticsPreview({
      limit: DASHBOARD_PRODUCT_ANALYTICS_LIMIT,
    }),
    getSettings(),
    prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        name: true,
      },
    }),
  ]);

  const bestSellerProductIds = bestSellerGroups.map((item) => item.productId);
  const visibleBestSellerGroups = bestSellerGroups.slice(
    0,
    DASHBOARD_TOP_PRODUCTS_LIMIT,
  );
  const bestSellerProducts = bestSellerProductIds.length
    ? await prisma.product.findMany({
        where: {
          id: {
            in: bestSellerProductIds,
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          imageUrl: true,
        },
      })
    : [];
  const productMap = new Map(
    bestSellerProducts.map((product) => [product.id, product]),
  );
  const grossToday = salesToday._sum.subtotal ?? 0;
  const grossYesterday = salesYesterday._sum.subtotal ?? 0;
  const returnTodayValue = returnsToday._sum.totalRefund ?? 0;
  const grossMonth = salesMonth._sum.subtotal ?? 0;
  const grossPrevMonth = salesPrevMonth._sum.subtotal ?? 0;
  const returnMonthValue = returnsMonth._sum.totalRefund ?? 0;
  const returnPrevMonthValue = returnsPrevMonth._sum.totalRefund ?? 0;
  const netToday = Math.max(grossToday - returnTodayValue, 0);
  const netMonth = Math.max(grossMonth - returnMonthValue, 0);
  const supplierReturnTodayValue = supplierReturnsToday._sum.totalAmount ?? 0;
  const supplierReturnMonthValue = supplierReturnsMonth._sum.totalAmount ?? 0;
  const netPurchaseMonth = Math.max(
    (purchasesMonth._sum.total ?? 0) - supplierReturnMonthValue,
    0,
  );
  const averageTransactionToday =
    salesToday._count._all > 0
      ? Math.round(grossToday / salesToday._count._all)
      : 0;
  const paymentTotal = paymentTodaySummary.reduce(
    (total, item) => total + (item._sum.subtotal ?? 0),
    0,
  );
  const cashTodayValue =
    paymentTodaySummary.find((item) => item.paymentMethod.toUpperCase() === "CASH")
      ?._sum.subtotal ?? 0;
  let paymentCursor = 0;
  const paymentGradient =
    paymentTodaySummary.length === 0 || paymentTotal === 0
      ? "#e2e8f0 0deg 360deg"
      : paymentTodaySummary
          .map((item, index) => {
            const value = item._sum.subtotal ?? 0;
            const size = (value / paymentTotal) * 360;
            const start = paymentCursor;
            const end = paymentCursor + size;
            paymentCursor = end;

            return `${paymentColors[index % paymentColors.length]} ${start}deg ${end}deg`;
          })
          .join(", ");
  const todayTransactionRows: KpiDetail["rows"] = todaySalesQuick.map((sale) => ({
    label: sale.invoiceNumber,
    value: rupiah(sale.subtotal),
    meta: `${transactionIdentityLabel({
      operator: sale.cashier,
      customer: sale.customer,
    })} • ${sale._count.items} item`,
    tone: sale._count.returns > 0 ? "danger" : "default",
  }));
  const todayReturnRows: KpiDetail["rows"] = todayReturnsQuick.map((saleReturn) => ({
    label: saleReturn.sale.invoiceNumber,
    value: rupiah(saleReturn.totalRefund ?? 0),
    meta: `${reasonLabel(saleReturn.reason)} - ${saleReturn.sale.customer?.name ?? "Walk-in"}`,
    tone: "danger",
  }));
  const lowStockRows: KpiDetail["rows"] = lowStockProducts.map((product) => ({
    label: product.name,
    value: `${product.stock} stok`,
    meta: product.sku ?? "-",
    tone: product.stock <= 0 ? "danger" : "default",
  }));
  const activeProductRows: KpiDetail["rows"] = activeProductSamples.map((product) => ({
    label: product.name,
    value: `${product.stock} stok`,
    meta: `${product.sku ?? "-"}${product.category ? ` - ${product.category}` : ""}`,
  }));
  const topReturnReason = returnReasonGroups[0];
  const monthRange = `${formatDate(monthStart)} - ${formatDate(selectedDate)}`;
  const kpiCards: {
    title: string;
    value: string;
    helper: string;
    trend?: {
      text: string;
      positive: boolean;
    };
    icon: KpiIconName;
    tone: StatTone;
    detail: KpiDetail;
  }[] = [
    {
      title: "Omzet Hari Ini",
      value: rupiah(grossToday),
      helper: "dari kemarin",
      trend: trendLabel(grossToday, grossYesterday, ""),
      icon: "line-chart",
      tone: "emerald",
      detail: {
        title: "Omzet Hari Ini",
        description: `Ringkasan transaksi pada ${formatDate(selectedDate)}.`,
        rows: [
          { label: "Omzet kotor", value: rupiah(grossToday), tone: "good" },
          { label: "Transaksi", value: String(salesToday._count._all) },
          { label: "ATV", value: rupiah(averageTransactionToday) },
        ],
      },
    },
    {
      title: "Omzet Bersih Hari Ini",
      value: rupiah(netToday),
      helper: "setelah retur",
      trend: trendLabel(netToday, Math.max(grossYesterday, 0), ""),
      icon: "wallet",
      tone: "emerald",
      detail: {
        title: "Omzet Bersih Hari Ini",
        description: "Omzet kotor dikurangi retur customer pada tanggal aktif.",
        rows: [
          { label: "Omzet kotor", value: rupiah(grossToday) },
          { label: "Nilai retur customer", value: rupiah(returnTodayValue), tone: "danger" },
          { label: "Omzet bersih", value: rupiah(netToday), tone: "good" },
        ],
      },
    },
    {
      title: "Retur Hari Ini",
      value: String(returnsToday._count._all),
      helper: rupiah(returnTodayValue),
      icon: "rotate",
      tone: "violet",
      detail: {
        title: "Retur Hari Ini",
        description: "Retur customer pada tanggal aktif.",
        emptyLabel: "Belum ada retur customer hari ini.",
        rows: todayReturnRows,
      },
    },
    {
      title: "Transaksi Hari Ini",
      value: String(salesToday._count._all),
      helper: "Semua transaksi",
      icon: "clipboard",
      tone: "blue",
      detail: {
        title: "Transaksi Hari Ini",
        description: "Daftar transaksi terbaru pada tanggal aktif.",
        emptyLabel: "Belum ada transaksi hari ini.",
        rows: todayTransactionRows,
      },
    },
    {
      title: "ATV Hari Ini",
      value: rupiah(averageTransactionToday),
      helper: "dari kemarin",
      trend: trendLabel(
        averageTransactionToday,
        salesYesterday._count._all > 0
          ? Math.round(grossYesterday / salesYesterday._count._all)
          : 0,
        "",
      ),
      icon: "shopping-cart",
      tone: "violet",
      detail: {
        title: "ATV Hari Ini",
        description: "Average transaction value pada tanggal aktif.",
        rows: [
          { label: "Total omzet", value: rupiah(grossToday) },
          { label: "Jumlah transaksi", value: String(salesToday._count._all) },
          { label: "ATV", value: rupiah(averageTransactionToday), tone: "good" },
        ],
      },
    },
    {
      title: "Omzet Bulan Ini",
      value: rupiah(grossMonth),
      helper: "dari bulan lalu",
      trend: trendLabel(grossMonth, grossPrevMonth, ""),
      icon: "line-chart",
      tone: "amber",
      detail: {
        title: "Omzet Bulan Ini",
        description: `Periode ${monthRange}.`,
        rows: [
          { label: "Omzet bulan berjalan", value: rupiah(grossMonth), tone: "good" },
          { label: "Transaksi bulan berjalan", value: String(salesMonth._count._all) },
          { label: "Omzet bulan lalu", value: rupiah(grossPrevMonth) },
        ],
      },
    },
    {
      title: "Omzet Bersih Bulan Ini",
      value: rupiah(netMonth),
      helper: "dari bulan lalu",
      trend: trendLabel(netMonth, Math.max(grossPrevMonth - returnPrevMonthValue, 0), ""),
      icon: "wallet",
      tone: "amber",
      detail: {
        title: "Omzet Bersih Bulan Ini",
        description: "Omzet bulan berjalan setelah dikurangi retur customer.",
        rows: [
          { label: "Omzet kotor", value: rupiah(grossMonth) },
          { label: "Nilai retur customer", value: rupiah(returnMonthValue), tone: "danger" },
          { label: "Omzet bersih", value: rupiah(netMonth), tone: "good" },
        ],
      },
    },
    {
      title: "Nilai Retur Bulan Ini",
      value: rupiah(returnMonthValue),
      helper: "customer return",
      trend: trendLabel(returnMonthValue, returnPrevMonthValue, ""),
      icon: "package",
      tone: "rose",
      detail: {
        title: "Nilai Retur Bulan Ini",
        description: "Total nilai refund customer return pada bulan berjalan.",
        rows: [
          { label: "Nilai retur", value: rupiah(returnMonthValue), tone: "danger" },
          { label: "Jumlah retur", value: String(returnsMonth._count._all) },
          {
            label: "Alasan terbesar",
            value: topReturnReason ? reasonLabel(topReturnReason.reason) : "-",
            meta: topReturnReason ? rupiah(topReturnReason._sum.totalRefund ?? 0) : undefined,
          },
        ],
      },
    },
    {
      title: "Total Retur Bulan Ini",
      value: String(returnsMonth._count._all),
      helper: "retur customer",
      icon: "shopping-bag",
      tone: "amber",
      detail: {
        title: "Total Retur Bulan Ini",
        description: "Jumlah transaksi retur customer bulan berjalan.",
        rows: returnReasonGroups.map((item) => ({
          label: reasonLabel(item.reason),
          value: `${item._count._all} retur`,
          meta: rupiah(item._sum.totalRefund ?? 0),
          tone: "danger",
        })),
        emptyLabel: "Belum ada retur customer bulan ini.",
      },
    },
    {
      title: "Produk Aktif",
      value: String(productsActive),
      helper: "Siap dijual",
      icon: "package",
      tone: "emerald",
      detail: {
        title: "Produk Aktif",
        description: "Ringkasan produk aktif yang tersedia untuk operasional POS.",
        rows: [
          { label: "Total produk aktif", value: String(productsActive), tone: "good" },
          { label: "Produk stok rendah", value: String(lowStockProducts.length) },
          ...activeProductRows,
        ],
      },
    },
    {
      title: "Stok Rendah",
      value: String(lowStockProducts.length),
      helper: "Stok <= min stok",
      icon: "alert",
      tone: "rose",
      detail: {
        title: "Stok Rendah",
        description: "Produk aktif dengan stok di bawah atau sama dengan min stok masing-masing.",
        rows: lowStockRows,
        emptyLabel: "Tidak ada produk stok rendah.",
      },
    },
    {
      title: "Retur Supplier Hari Ini",
      value: rupiah(supplierReturnTodayValue),
      helper: `${supplierReturnsToday._count._all} retur supplier`,
      icon: "truck",
      tone: "emerald",
      detail: {
        title: "Retur Supplier Hari Ini",
        description: "Nilai retur ke supplier pada tanggal aktif.",
        rows: [
          { label: "Nilai retur supplier", value: rupiah(supplierReturnTodayValue) },
          { label: "Jumlah retur supplier", value: String(supplierReturnsToday._count._all) },
        ],
      },
    },
    {
      title: "Retur Supplier Bulan Ini",
      value: rupiah(supplierReturnMonthValue),
      helper: `${supplierReturnsMonth._count._all} retur supplier`,
      icon: "truck",
      tone: "emerald",
      detail: {
        title: "Retur Supplier Bulan Ini",
        description: "Retur supplier adalah data inventory-side dan tidak mengurangi omzet penjualan.",
        rows: [
          { label: "Nilai retur supplier", value: rupiah(supplierReturnMonthValue) },
          { label: "Jumlah retur supplier", value: String(supplierReturnsMonth._count._all) },
        ],
      },
    },
    {
      title: "Net Pembelian Bulan Ini",
      value: rupiah(netPurchaseMonth),
      helper: `${purchasesMonth._count._all} pembelian`,
      icon: "shopping-cart",
      tone: "amber",
      detail: {
        title: "Net Pembelian Bulan Ini",
        description: "Pembelian bulan berjalan dikurangi retur supplier bulan berjalan.",
        rows: [
          { label: "Total pembelian", value: rupiah(purchasesMonth._sum.total ?? 0) },
          { label: "Retur supplier", value: rupiah(supplierReturnMonthValue), tone: "danger" },
          { label: "Net pembelian", value: rupiah(netPurchaseMonth), tone: "good" },
        ],
      },
    },
  ];
  const cashKpiCard: (typeof kpiCards)[number] = {
    title: "Cash Belum Closing",
    value: rupiah(cashTodayValue),
    helper: "Expected cash drawer",
    icon: "wallet" as KpiIconName,
    tone: "amber" as StatTone,
    detail: {
      title: "Cash Belum Closing",
      description: "Estimasi cash drawer dari transaksi cash pada tanggal aktif.",
      rows: [
        { label: "Cash tanggal aktif", value: rupiah(cashTodayValue), tone: "good" as const },
        { label: "Transaksi tanggal aktif", value: String(salesToday._count._all) },
        { label: "Tanggal", value: formatDate(selectedDate) },
      ],
    },
  };
  const dashboardKpiCards = [
    kpiCards[1],
    kpiCards[3],
    kpiCards[2],
    cashKpiCard,
    kpiCards[10],
  ];
  const recentSaleRows = recentSales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    subtotal: rupiah(sale.subtotal),
    createdAt: formatDateTime(sale.createdAt),
    cashierName: sale.cashier.name,
    cashierRoleName: sale.cashier.role?.name ?? null,
    cashierRoleSlug: sale.cashier.role?.slug ?? null,
    customerName: sale.customer?.name ?? "Walk-in",
    itemCount: sale._count.items,
    returnCount: sale._count.returns,
    paymentMethod: sale.paymentMethod,
    transactionStatus: sale.transactionStatus,
    paymentStatus: sale.paymentStatus,
    items: sale.items.map((item) => ({
      name: item.product.name,
      sku: item.product.sku ?? "-",
      qty: item.qty,
    })),
  }));
  const paymentRows = paymentTodaySummary.map((item, index) => {
    const total = item._sum.subtotal ?? 0;
    const percent = paymentTotal > 0 ? (total / paymentTotal) * 100 : 0;

    return {
      method: item.paymentMethod,
      total: rupiah(total),
      count: item._count._all,
      percent: `${percent.toFixed(1)}%`,
      color: paymentColors[index % paymentColors.length],
      href: `/sales?from=${dateInputValue(monthStart)}&to=${selectedDateInput}&payment=${item.paymentMethod}`,
    };
  });
  const slowMovingItems: ProductAnalyticsCardItem[] =
    productAnalytics.slowMoving.items.map((product) => {
      const query = product.sku ?? product.name;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        daysSinceLastSold: product.daysSinceLastSold,
        detailHref: `/products?q=${encodeURIComponent(query)}`,
      };
    });
  const deadStockItems: ProductAnalyticsCardItem[] =
    productAnalytics.deadStock.items.map((product) => {
      const query = product.sku ?? product.name;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        daysSinceLastSold: product.daysSinceLastSold,
        detailHref: `/products?q=${encodeURIComponent(query)}`,
      };
    });
  const operationalAlerts: OperationalAlert[] = [
    ...(lowStockProducts.length > 0
      ? [
          {
            id: "stock-low",
            title: `${lowStockProducts.length} produk stok rendah`,
            helper: "Ada produk di bawah stok minimum",
            detail:
              "Produk stok rendah perlu dicek sebelum penjualan berikutnya. Batas stok mengikuti min stok masing-masing produk.",
            severity: "critical" as const,
            href: "/products",
            action: "Lihat stok rendah",
          },
        ]
      : []),
    ...(productAnalytics.deadStock.total > 0
      ? [
          {
            id: "dead-stock",
            title: `${productAnalytics.deadStock.total} produk dead stock`,
            helper: `Tidak terjual >= ${productAnalytics.deadStock.thresholdDays} hari`,
            detail:
              "Dead Stock berbeda dari stok rendah: barang masih punya stok, tetapi belum pernah terjual atau lama tidak terjual.",
            severity: "warning" as const,
            href: "/products",
            action: "Lihat produk",
          },
        ]
      : []),
    ...(returnsToday._count._all > 0
      ? [
          {
            id: "return-today",
            title: `${returnsToday._count._all} retur hari ini`,
            helper: "Ada retur customer pada tanggal aktif",
            detail: `Nilai retur customer hari ini ${rupiah(returnTodayValue)}. Buka daftar retur untuk audit item dan alasan retur.`,
            severity: "warning" as const,
            href: "/returns",
            action: "Lihat retur",
          },
        ]
      : []),
    ...(returnReasonGroups.length > 0
      ? [
          {
            id: "return-month",
            title: "Ringkasan retur bulan ini",
            helper: `${returnsMonth._count._all} retur customer`,
            detail: `Terdapat ${returnsMonth._count._all} retur customer bulan ini dengan nilai ${rupiah(returnMonthValue)}.`,
            severity: "info" as const,
            href: "/returns",
            action: "Buka daftar retur",
          },
        ]
      : []),
    ...(supplierReturnsToday._count._all > 0
      ? [
          {
            id: "supplier-return-today",
            title: `${supplierReturnsToday._count._all} retur supplier hari ini`,
            helper: `${rupiah(supplierReturnTodayValue)} inventory-side`,
            detail:
              "Retur supplier dicatat terpisah dari omzet penjualan dan tetap perlu dipantau dari modul retur supplier.",
            severity: "info" as const,
            href: "/returns/supplier",
            action: "Lihat retur supplier",
          },
        ]
      : []),
  ];
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 11 ? "Selamat pagi" : currentHour < 15 ? "Selamat siang" : currentHour < 18 ? "Selamat sore" : "Selamat malam";
  const ownerName = currentUser?.name ?? settings.ownerName ?? "Owner";
  const storeName = settings.storeName || "Toko Pancing";
  const headerDate = formatHeaderDate(selectedDate);
  const monthlyMetrics = [
    {
      title: "Omzet Kotor",
      value: rupiah(grossMonth),
      helper: `${trendLabel(grossMonth, grossPrevMonth, "").text} dari bulan lalu`,
      icon: LineChart,
      tone: "emerald" as StatTone,
    },
    {
      title: "Omzet Bersih",
      value: rupiah(netMonth),
      helper: `${trendLabel(netMonth, Math.max(grossPrevMonth - returnPrevMonthValue, 0), "").text} dari bulan lalu`,
      icon: Wallet,
      tone: "emerald" as StatTone,
    },
    {
      title: "Transaksi",
      value: String(salesMonth._count._all),
      helper: "Bulan berjalan",
      icon: ClipboardList,
      tone: "blue" as StatTone,
    },
    {
      title: "ATV (Avg. Transaksi)",
      value:
        salesMonth._count._all > 0
          ? rupiah(Math.round(grossMonth / salesMonth._count._all))
          : rupiah(0),
      helper: "Rata-rata transaksi",
      icon: ShoppingCart,
      tone: "violet" as StatTone,
    },
    {
      title: "Retur",
      value: rupiah(returnMonthValue),
      helper: `${returnsMonth._count._all} retur customer`,
      icon: RotateCcw,
      tone: "rose" as StatTone,
    },
    {
      title: "Pembelian",
      value: rupiah(purchasesMonth._sum.total ?? 0),
      helper: "Total pembelian bulan ini",
      icon: ShoppingBag,
      tone: "amber" as StatTone,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 sm:space-y-5">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.045)] dark:border-slate-800 dark:bg-slate-950/80 sm:p-5 xl:p-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
            {greeting}, {ownerName}
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {storeName}
          </p>
        </div>

        <div className="mt-4">
          <DashboardStatusChips
            selectedDateInput={selectedDateInput}
            selectedDateLabel={formatDate(selectedDate)}
            userName={ownerName}
            role={session.role}
            lowStockCount={lowStockProducts.length}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_38px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/80 sm:p-4">
        <DashboardTopActions
          selectedDateInput={selectedDateInput}
          selectedDateLabel={headerDate}
          cashAmount={rupiah(cashTodayValue)}
          cashValue={cashTodayValue}
          grossOmzet={rupiah(grossToday)}
          returnValue={rupiah(returnTodayValue)}
          transactionCount={salesToday._count._all}
          notificationCount={operationalAlerts.length}
          payments={paymentRows}
          closedBy={ownerName}
        />
      </section>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        {dashboardKpiCards.map((card, index) => (
          <div
            key={card.title}
            className={`min-w-0 ${
              index === dashboardKpiCards.length - 1 ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <KpiActionCard key={card.title} {...card} />
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <TransactionPaymentPanel
          recentSales={recentSaleRows}
          paymentSummary={paymentRows}
          paymentTotal={rupiah(paymentTotal)}
          paymentGradient={paymentGradient}
          expectedCash={rupiah(cashTodayValue)}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-12">
        <section className="flex h-full min-w-0 flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 xl:col-span-4">
          <SectionHeader title="Produk Terlaris Hari Ini" href={salesHref(selectedDateInput)} />
          <div className="mt-4 flex-1 rounded-2xl border border-slate-100 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-900/30">
            {visibleBestSellerGroups.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                label="Belum ada produk terjual hari ini."
              />
            ) : null}
            {visibleBestSellerGroups.length > 0 ? (
              <div className="space-y-2 p-3">
                {visibleBestSellerGroups.map((item, index) => {
                  const product = productMap.get(item.productId);

                  return (
                    <Link
                      key={item.productId}
                      href={`/products?q=${encodeURIComponent(product?.sku ?? product?.name ?? "")}`}
                      className="grid min-h-20 grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:border-teal-100 hover:bg-teal-50/40 hover:shadow-sm active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-teal-500/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
                          {index + 1}
                        </span>
                        <ProductThumb imageUrl={product?.imageUrl} name={product?.name ?? "Produk"} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-950 dark:text-white">
                            {product?.name ?? "Produk tidak ditemukan"}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {product?.sku ?? "-"}
                          </span>
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:grid sm:shrink-0 sm:gap-1 sm:text-right">
                        <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Terjual{" "}
                          <span className="font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                            {item._sum.qty ?? 0}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-slate-950 dark:text-white">
                          {rupiah(item._sum.subtotal ?? 0)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <div className="min-w-0 xl:col-span-4">
          <OperationalAlerts
            alerts={operationalAlerts}
            maxItems={DASHBOARD_ALERT_LIMIT}
          />
        </div>

        <div className="min-w-0 xl:col-span-4">
          <ProductAnalyticsCard
            slowMoving={{
              title: "Slow Moving",
              helper: `Tidak terjual >= ${productAnalytics.slowMoving.thresholdDays} hari`,
              href: "/products?filter=slow-moving",
              total: productAnalytics.slowMoving.total,
              items: slowMovingItems,
              tone: "amber",
            }}
            deadStock={{
              title: "Dead Stock",
              helper: `Tidak terjual >= ${productAnalytics.deadStock.thresholdDays} hari`,
              href: "/products?filter=dead-stock",
              total: productAnalytics.deadStock.total,
              items: deadStockItems,
              tone: "rose",
            }}
          />
        </div>

        <section className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 lg:col-span-2 xl:col-span-12">
          <SectionHeader title={`Ringkasan Bulanan (${formatMonthYear(monthStart)})`} href="/reports" />
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {monthlyMetrics.map((metric) => (
              <MiniMetricCard key={metric.title} {...metric} />
            ))}
          </div>
        </section>
      </div>

      <footer className="flex flex-col items-center justify-center gap-2 pb-2 text-xs text-slate-500 sm:flex-row sm:gap-8">
        <span>Powered by Meijrverse</span>
        <span className="hidden h-4 w-px bg-slate-300 sm:block dark:bg-slate-700" />
        <span>Developer: Akbar Fahreza a.k.a Alexander Van Meijr</span>
      </footer>
    </div>
  );
}
