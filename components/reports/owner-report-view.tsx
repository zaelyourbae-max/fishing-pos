"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Package,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type KpiTone = "emerald" | "rose" | "blue" | "violet" | "amber";

type KpiCard = {
  id: string;
  title: string;
  value: string;
  helper: string;
  tone: KpiTone;
  icon: "chart" | "return" | "wallet" | "transaction" | "atv" | "purchase" | "supplier" | "profit";
  rows: { label: string; value: string; tone?: "default" | "good" | "danger" }[];
};

type PaymentRow = {
  method: string;
  label: string;
  total: number;
  formattedTotal: string;
  transactions: number;
  percent: number;
  color: string;
};

type ProductRow = {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  total: number;
  formattedTotal: string;
  stock: number;
};

type ReturnReasonRow = {
  reason: string;
  label: string;
  returns: number;
  formattedTotal: string;
};

type ReturnRecord = {
  id: string;
  number: string;
  date: string;
  reason: string;
  total: string;
  supplier?: string;
  supplierType?: string;
};

type TransactionRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  createdAtLabel: string;
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  paymentLabel: string;
  transactionStatus: string;
  paymentStatus: string;
  subtotal: number;
  formattedSubtotal: string;
  itemCount: number;
  returnCount: number;
};

type TrendRow = {
  label: string;
  omzet: number;
  transactions: number;
};

type LowStockRow = {
  id: number;
  name: string;
  sku: string;
  stock: number;
  minimumStock: number;
};

type PurchaseRow = {
  id: string;
  number: string;
  date: string;
  supplier: string;
  total: string;
};

type ProfitProductRow = {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  revenue: string;
  cogs: string;
  profit: string;
  margin: string;
};

type MonthlySummaryItem = {
  label: string;
  value: string;
  tone: KpiTone;
};

export type OwnerReportViewData = {
  period: {
    preset: string;
    from: string;
    to: string;
    label: string;
    updatedAt: string;
  };
  exportHref: string;
  kpis: KpiCard[];
  payments: PaymentRow[];
  paymentTotal: string;
  reconciliation: {
    netOmzet: string;
    totalPayment: string;
    difference: number;
    differenceLabel: string;
  };
  bestSellers: ProductRow[];
  returnSummary: {
    count: number;
    value: string;
    rawValue: number;
    topReason: string;
    supplierCount: number;
    supplierValue: string;
    supplierRawValue: number;
    reasons: ReturnReasonRow[];
    recentCustomer: ReturnRecord[];
    recentSupplier: ReturnRecord[];
  };
  lowStock: LowStockRow[];
  recentPurchases: PurchaseRow[];
  profitSummary: {
    hasUnitCostSnapshot: boolean;
    grossRevenue: string;
    returnRevenue: string;
    netRevenue: string;
    salesCogs: string;
    returnCogs: string;
    netCogs: string;
    grossProfit: string;
    netProfit: string;
    margin: string;
    returnCostWarning: string | null;
    topProducts: ProfitProductRow[];
  };
  monthlySummary: {
    title: string;
    items: MonthlySummaryItem[];
  };
  transactions: TransactionRow[];
  trend: TrendRow[];
  cashiers: string[];
  paymentMethods: string[];
};

type OwnerReportViewProps = {
  data: OwnerReportViewData;
};

const presets = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "month", label: "Bulan Ini" },
  { key: "yesterday", label: "Bulan Lalu" },
  { key: "custom", label: "Custom" },
];

const desktopTabs = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "penjualan", label: "Penjualan" },
  { id: "pembayaran", label: "Pembayaran" },
  { id: "retur", label: "Retur" },
  { id: "produk", label: "Produk" },
  { id: "pembelian", label: "Pembelian" },
  { id: "stok", label: "Stok" },
  { id: "laba-margin", label: "Laba & Margin" },
];

const mobileTabs = [
  { id: "penjualan", label: "Penjualan" },
  { id: "pembayaran", label: "Pembayaran" },
  { id: "produk", label: "Produk" },
  { id: "retur", label: "Retur" },
  { id: "stok", label: "Stok" },
  { id: "bulanan", label: "Bulanan" },
] as const;

type MobileStatsTab = (typeof mobileTabs)[number]["id"];

const toneClass: Record<KpiTone, { badge: string; soft: string; text: string; border: string }> = {
  emerald: {
    badge: "bg-emerald-50 text-emerald-700",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-100",
  },
  rose: {
    badge: "bg-rose-50 text-rose-700",
    soft: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-100",
  },
  blue: {
    badge: "bg-blue-50 text-blue-700",
    soft: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-100",
  },
  violet: {
    badge: "bg-violet-50 text-violet-700",
    soft: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-100",
  },
  amber: {
    badge: "bg-orange-50 text-orange-700",
    soft: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-100",
  },
};

const iconMap: Record<KpiCard["icon"], LucideIcon> = {
  chart: BarChart3,
  return: RotateCcw,
  wallet: Wallet,
  transaction: FileText,
  atv: BarChart3,
  purchase: ShoppingBag,
  supplier: Package,
  profit: Wallet,
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function rupiahCompact(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`;
  return `Rp ${value}`;
}

function paymentBadgeClass(method: string) {
  const key = method.toLowerCase();

  if (key.includes("cash")) return "bg-emerald-50 text-emerald-700";
  if (key.includes("qris")) return "bg-blue-50 text-blue-700";
  if (key.includes("transfer")) return "bg-violet-50 text-violet-700";
  if (key.includes("card") || key.includes("kartu")) return "bg-orange-50 text-orange-700";
  return "bg-slate-100 text-slate-700";
}

function statusBadgeClass(status: string) {
  if (status === "SUCCESS" || status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING" || status === "WAITING_PROOF") return "bg-amber-50 text-amber-700";
  if (status === "CANCELLED" || status === "FAILED") return "bg-rose-50 text-rose-700";
  if (status === "UNPAID") return "bg-slate-100 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <PackageOpen className="h-7 w-7 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function ReportSectionCard({
  id,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        "min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 md:p-5",
        className,
      )}
    >
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-extrabold text-slate-950 md:text-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  kpi,
  compact = false,
  onOpen,
}: {
  kpi: KpiCard;
  compact?: boolean;
  onOpen?: (kpi: KpiCard) => void;
}) {
  const Icon = iconMap[kpi.icon];
  const clickable = Boolean(onOpen);
  const commonButtonProps = {
    "aria-label": clickable
      ? `Buka detail ${kpi.title}`
      : `${kpi.title} hanya ringkasan`,
    disabled: !clickable,
    onClick: clickable ? () => onOpen?.(kpi) : undefined,
    title: kpi.helper,
    type: "button" as const,
  };

  if (compact) {
    return (
      <button
        {...commonButtonProps}
        className={cx(
          "group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm shadow-slate-200/60 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
          clickable
            ? "cursor-pointer hover:border-blue-200 active:scale-[0.99]"
            : "cursor-default",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", toneClass[kpi.tone].badge)}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-xs font-bold leading-tight text-slate-500">{kpi.title}</p>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-500">
            i
          </span>
        </div>
        <p className="mt-3 break-words text-lg font-extrabold leading-snug tracking-tight text-slate-950">
          {kpi.value}
        </p>
        <p className={cx("mt-2 text-xs font-semibold leading-tight", toneClass[kpi.tone].text)}>
          {kpi.helper}
        </p>
      </button>
    );
  }

  return (
    <button
      {...commonButtonProps}
      className={cx(
        "group min-w-0 rounded-2xl border border-slate-200 bg-white text-left shadow-sm shadow-slate-200/60 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[0.99]"
          : "cursor-default",
        "p-4 md:p-5",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cx(
            "flex shrink-0 items-center justify-center rounded-2xl",
            "h-12 w-12",
            toneClass[kpi.tone].badge,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-xs font-bold text-slate-500">{kpi.title}</p>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-500">
              i
            </span>
          </div>
          <p
            className={cx(
              "mt-1 font-extrabold tracking-tight text-slate-950",
              "text-xl leading-snug",
            )}
          >
            {kpi.value}
          </p>
          <p className={cx("mt-2 line-clamp-2 text-xs font-semibold", toneClass[kpi.tone].text)}>
            {kpi.helper}
          </p>
        </div>
      </div>
    </button>
  );
}

function MainKpiCard({
  kpi,
  onOpen,
}: {
  kpi: KpiCard;
  onOpen?: (kpi: KpiCard) => void;
}) {
  const Icon = iconMap[kpi.icon];

  return (
    <button
      type="button"
      onClick={() => onOpen?.(kpi)}
      className="w-full cursor-pointer rounded-2xl bg-blue-600 p-4 text-left text-[#fff] shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-[0.99]"
      aria-label={`Buka detail ${kpi.title}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-100">{kpi.title}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#fff]">{kpi.value}</p>
          <p className="mt-2 text-xs font-semibold text-blue-100">{kpi.helper}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[#fff]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </button>
  );
}

function TrendChart({ rows, compact = false }: { rows: TrendRow[]; compact?: boolean }) {
  const chartRows = rows.length ? rows : [{ label: "-", omzet: 0, transactions: 0 }];
  const width = 640;
  const height = compact ? 220 : 260;
  const padding = { top: 18, right: 16, bottom: 40, left: 54 };
  const maxOmzet = Math.max(...chartRows.map((row) => row.omzet), 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const pointX = (index: number) =>
    padding.left + (chartRows.length === 1 ? 0 : (index / (chartRows.length - 1)) * innerWidth);
  const pointY = (value: number) => padding.top + (1 - value / maxOmzet) * innerHeight;
  const points = chartRows.map((row, index) => `${pointX(index)},${pointY(row.omzet)}`).join(" ");
  const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${
    padding.left + innerWidth
  },${height - padding.bottom}`;
  const labelLimit = compact ? 4 : 7;
  const step = Math.max(Math.ceil(chartRows.length / labelLimit), 1);
  const labelIndexes = new Set(
    chartRows
      .map((_, index) => index)
      .filter((index) => index === 0 || index === chartRows.length - 1 || index % step === 0),
  );

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cx("w-full", compact ? "h-[220px]" : "h-64")}
        role="img"
        aria-label="Trend Penjualan Omzet Bersih"
      >
        <defs>
          <linearGradient id={compact ? "mobileTrendFill" : "desktopTrendFill"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((tick) => {
          const y = padding.top + tick * innerHeight;

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text x="8" y={y + 4} fontSize="12" fontWeight="700" fill="#475569">
                {rupiahCompact(Math.round(maxOmzet * (1 - tick)))}
              </text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill={`url(#${compact ? "mobileTrendFill" : "desktopTrendFill"})`} />
        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {chartRows.map((row, index) => {
          const x = pointX(index);
          const y = pointY(row.omzet);

          return (
            <g key={`${row.label}-${index}`}>
              <circle cx={x} cy={y} r="4.5" fill="#2563eb">
                <title>{`${row.label}: ${rupiahCompact(row.omzet)} (${row.transactions} transaksi)`}</title>
              </circle>
              {labelIndexes.has(index) ? (
                <text x={x} y={height - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
                  {row.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PaymentSummary({ payments, total, desktopDonut = false }: { payments: PaymentRow[]; total: string; desktopDonut?: boolean }) {
  const background = useMemo(() => {
    if (!payments.length) return "conic-gradient(#e2e8f0 0 100%)";

    let start = 0;
    const segments = payments.map((payment) => {
      const end = start + payment.percent;
      const segment = `${payment.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [payments]);

  if (!payments.length) {
    return <EmptyState label="Belum ada pembayaran pada periode ini." />;
  }

  return (
    <div className={cx("min-w-0", desktopDonut && "grid items-center gap-5 md:grid-cols-[220px_minmax(0,1fr)]")}>
      {desktopDonut ? (
        <div className="relative mx-auto hidden h-48 w-48 rounded-full md:block" style={{ background }}>
          <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <p className="text-xs font-bold text-slate-500">Total</p>
            <p className="mt-1 text-sm font-extrabold text-slate-950">{total}</p>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.method} className="min-w-0 rounded-xl border border-slate-100 p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: payment.color }} />
                <span className="truncate text-sm font-bold text-slate-700">{payment.label}</span>
              </div>
              <span className="shrink-0 text-right text-sm font-extrabold tabular-nums text-slate-950">
                {payment.formattedTotal}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(payment.percent, 2)}%`, backgroundColor: payment.color }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {payment.transactions} transaksi - {payment.percent.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProducts({
  products,
  mobile = false,
  onSelect,
}: {
  products: ProductRow[];
  mobile?: boolean;
  onSelect?: (product: ProductRow) => void;
}) {
  if (!products.length) return <EmptyState label="Belum ada produk terjual pada periode ini." />;

  if (mobile) {
    return (
      <div className="space-y-3">
        {products.slice(0, 5).map((product, index) => (
          <button
            key={product.productId}
            type="button"
            onClick={() => onSelect?.(product)}
            className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-[0.99]"
            aria-label={`Buka detail produk ${product.name}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-950">{product.name}</p>
              <p className="truncate text-xs font-semibold text-slate-500">{product.sku || "-"}</p>
              <p className="mt-1 text-xs font-bold text-slate-600">{product.qty} qty terjual</p>
            </div>
            <span className="shrink-0 text-right text-sm font-extrabold tabular-nums text-slate-950">
              {product.formattedTotal}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="w-12 px-4 py-3">#</th>
            <th className="px-4 py-3">Produk</th>
            <th className="px-4 py-3 text-right">Terjual (Qty)</th>
            <th className="px-4 py-3 text-right">Omzet</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.slice(0, 5).map((product, index) => (
            <tr
              key={product.productId}
              onClick={() => onSelect?.(product)}
              className="cursor-pointer transition hover:bg-blue-50/50 focus-within:bg-blue-50/50"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(product);
                }
              }}
              aria-label={`Buka detail produk ${product.name}`}
            >
              <td className="px-4 py-3 font-extrabold text-slate-500">{index + 1}</td>
              <td className="min-w-0 px-4 py-3">
                <p className="font-extrabold text-slate-950">{product.name}</p>
                <p className="text-xs font-semibold text-slate-500">{product.sku || "-"}</p>
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700">{product.qty}</td>
              <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
                {product.formattedTotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnSummary({ summary }: { summary: OwnerReportViewData["returnSummary"] }) {
  const hasReturns = summary.rawValue > 0 || summary.supplierRawValue > 0 || summary.recentCustomer.length > 0 || summary.recentSupplier.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700">Customer Return</p>
          <p className="mt-2 text-xl font-extrabold text-slate-950">{summary.value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{summary.count} transaksi</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-xs font-bold text-orange-700">Supplier Return</p>
          <p className="mt-2 text-xl font-extrabold text-slate-950">{summary.supplierValue}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{summary.supplierCount} transaksi</p>
        </div>
      </div>
      {!hasReturns ? <EmptyState label="Belum ada retur pada periode ini." /> : null}
      {summary.recentCustomer.length ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Retur terbesar customer</p>
          <div className="space-y-2">
            {summary.recentCustomer.slice(0, 3).map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-100 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-slate-950">{item.number}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{item.date} - {item.reason}</p>
                </div>
                <strong className="text-right tabular-nums text-rose-700">{item.total}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {summary.recentSupplier.length ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Retur supplier terbaru</p>
          <div className="space-y-2">
            {summary.recentSupplier.slice(0, 3).map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-100 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-slate-950">{item.number}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{item.supplier ?? "-"} - {item.reason}</p>
                </div>
                <strong className="text-right tabular-nums text-orange-700">{item.total}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LowStockList({ rows, mobile = false }: { rows: LowStockRow[]; mobile?: boolean }) {
  if (!rows.length) return <EmptyState label="Tidak ada stok rendah saat ini." />;

  if (mobile) {
    return (
      <div className="space-y-3">
        {rows.map((product) => (
          <div key={product.id} className="rounded-2xl border border-slate-100 p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-950">{product.name}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{product.sku || "-"}</p>
              </div>
              <span
                className={cx(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
                  product.stock <= Math.max(Math.floor(product.minimumStock / 2), 1)
                    ? "bg-rose-50 text-rose-700"
                    : "bg-orange-50 text-orange-700",
                )}
              >
                {product.stock} stok
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">Minimum stok: {product.minimumStock}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="px-4 py-3">Produk</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3 text-right">Stok</th>
            <th className="px-4 py-3 text-right">Min. Stok</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((product) => (
            <tr key={product.id}>
              <td className="px-4 py-3 font-extrabold text-slate-950">{product.name}</td>
              <td className="px-4 py-3 font-semibold text-slate-500">{product.sku || "-"}</td>
              <td
                className={cx(
                  "px-4 py-3 text-right font-extrabold tabular-nums",
                  product.stock <= Math.max(Math.floor(product.minimumStock / 2), 1)
                    ? "text-rose-700"
                    : "text-orange-700",
                )}
              >
                {product.stock}
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700">{product.minimumStock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentTransactions({
  rows,
  mobile = false,
  onSelect,
}: {
  rows: TransactionRow[];
  mobile?: boolean;
  onSelect?: (sale: TransactionRow) => void;
}) {
  if (!rows.length) return <EmptyState label="Tidak ada transaksi pada periode ini." />;

  if (mobile) {
    return (
      <div className="space-y-3">
        {rows.slice(0, 5).map((sale) => (
          <button
            key={sale.id}
            type="button"
            onClick={() => onSelect?.(sale)}
            className="w-full cursor-pointer rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-[0.99]"
            aria-label={`Buka detail transaksi ${sale.invoiceNumber}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-950">{sale.invoiceNumber}</p>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {sale.createdAtLabel} - {sale.cashierName} - {sale.itemCount} item
                </p>
              </div>
              <strong className="shrink-0 text-right text-sm font-extrabold tabular-nums text-slate-950">
                {sale.formattedSubtotal}
              </strong>
            </div>
            <span className={cx("mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", paymentBadgeClass(sale.paymentMethod))}>
              {sale.paymentLabel}
            </span>
            <span className={cx("ml-2 mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", statusBadgeClass(sale.paymentStatus))}>
              {sale.paymentStatus}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[820px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[210px]" />
          <col className="w-[170px]" />
          <col className="w-[140px]" />
          <col className="w-[70px]" />
          <col className="w-[140px]" />
          <col className="w-[140px]" />
          <col className="w-[120px]" />
        </colgroup>
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="px-4 py-3">No. Transaksi</th>
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">Kasir</th>
            <th className="px-4 py-3 text-right">Item</th>
            <th className="px-4 py-3">Pembayaran</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, 6).map((sale) => (
            <tr
              key={sale.id}
              onClick={() => onSelect?.(sale)}
              className="cursor-pointer transition hover:bg-blue-50/50 focus-within:bg-blue-50/50"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(sale);
                }
              }}
              aria-label={`Buka detail transaksi ${sale.invoiceNumber}`}
            >
              <td className="px-4 py-3">
                <span
                  className="block truncate font-extrabold text-slate-950"
                  title={sale.invoiceNumber}
                >
                  {sale.invoiceNumber}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="block truncate font-semibold text-slate-600" title={sale.createdAtLabel}>
                  {sale.createdAtLabel}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="block truncate font-semibold text-slate-700" title={sale.cashierName}>
                  {sale.cashierName}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-700">{sale.itemCount}</td>
              <td className="px-4 py-3">
                <span className={cx("inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold", paymentBadgeClass(sale.paymentMethod))}>
                  {sale.paymentLabel}
                </span>
                <span className={cx("mt-1 inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold", statusBadgeClass(sale.paymentStatus))}>
                  {sale.paymentStatus}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">{sale.formattedSubtotal}</td>
              <td className="px-4 py-3">
                <span
                  className={cx(
                    "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold",
                    statusBadgeClass(sale.transactionStatus),
                  )}
                >
                  {sale.transactionStatus}
                </span>
                {sale.returnCount > 0 ? (
                  <span className="mt-1 inline-flex whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                    Ada retur
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlySummary({ summary, mobile = false }: { summary: OwnerReportViewData["monthlySummary"]; mobile?: boolean }) {
  return (
    <div className={cx("grid gap-3", mobile ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-6")}>
      {summary.items.map((item) => (
        <div key={item.label} className={cx("rounded-2xl border p-4", toneClass[item.tone].border, toneClass[item.tone].soft)}>
          <p className="text-xs font-bold text-slate-500">{item.label}</p>
          <p className="mt-2 truncate text-lg font-extrabold text-slate-950">{item.value}</p>
          <p className={cx("mt-2 text-xs font-semibold", toneClass[item.tone].text)}>Periode aktif</p>
        </div>
      ))}
    </div>
  );
}

function PurchasesList({ rows }: { rows: PurchaseRow[] }) {
  if (!rows.length) return <EmptyState label="Belum ada pembelian pada periode ini." />;

  return (
    <div className="space-y-2">
      {rows.slice(0, 5).map((purchase) => (
        <div key={purchase.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-100 p-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-extrabold text-slate-950">{purchase.number}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{purchase.date} - {purchase.supplier}</p>
          </div>
          <strong className="text-right tabular-nums text-slate-950">{purchase.total}</strong>
        </div>
      ))}
    </div>
  );
}

function ProfitSummary({ summary }: { summary: OwnerReportViewData["profitSummary"] }) {
  if (!summary.hasUnitCostSnapshot) {
    return (
      <EmptyState label="Data snapshot HPP belum tersedia. Laba dan margin akan muncul untuk transaksi baru setelah checkout menyimpan HPP." />
    );
  }

  return (
    <div className="space-y-4">
      {summary.returnCostWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {summary.returnCostWarning}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Omzet Bersih", value: summary.netRevenue, helper: "Setelah retur customer" },
          { label: "HPP Bersih", value: summary.netCogs, helper: "Snapshot HPP item terjual" },
          { label: "Laba Kotor", value: summary.netProfit, helper: `Margin ${summary.margin}` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <p className="mt-2 text-lg font-extrabold text-slate-950">{item.value}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-700">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-semibold text-slate-500">Omzet kotor</span>
            <strong className="tabular-nums text-slate-950">{summary.grossRevenue}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="font-semibold text-slate-500">Retur customer</span>
            <strong className="tabular-nums text-rose-700">{summary.returnRevenue}</strong>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-semibold text-slate-500">HPP penjualan</span>
            <strong className="tabular-nums text-slate-950">{summary.salesCogs}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="font-semibold text-slate-500">HPP retur</span>
            <strong className="tabular-nums text-rose-700">{summary.returnCogs}</strong>
          </div>
        </div>
      </div>

      {summary.topProducts.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Produk</th>
                <th className="px-3 py-3 text-right">Qty Net</th>
                <th className="px-3 py-3 text-right">Omzet</th>
                <th className="px-3 py-3 text-right">HPP</th>
                <th className="px-3 py-3 text-right">Laba</th>
                <th className="px-3 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.topProducts.map((item) => (
                <tr key={item.productId}>
                  <td className="px-3 py-3">
                    <p className="font-extrabold text-slate-950">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700">{item.qty}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">{item.revenue}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">{item.cogs}</td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-emerald-700">{item.profit}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700">{item.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function OwnerReportView({ data }: OwnerReportViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState(data.period.from);
  const [to, setTo] = useState(data.period.to);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [mobileTab, setMobileTab] = useState<MobileStatsTab>("penjualan");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KpiCard | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionRow | null>(null);
  const [showTrendDetail, setShowTrendDetail] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");

  const netKpi = data.kpis.find((kpi) => kpi.id === "net") ?? data.kpis[0];
  const mobileKpis = data.kpis.filter((kpi) => kpi.id !== "net");
  const trendTotal = data.trend.reduce((total, row) => total + row.omzet, 0);
  const trendTransactions = data.trend.reduce((total, row) => total + row.transactions, 0);
  const bestTrendDay = data.trend.reduce(
    (best, row) => (row.omzet > best.omzet ? row : best),
    data.trend[0] ?? { label: "-", omzet: 0, transactions: 0 },
  );

  function canOpenKpi(kpi: KpiCard) {
    if (kpi.id === "products-sold") {
      return data.bestSellers.length > 0;
    }

    return ["gross", "returns", "net", "transactions", "atv", "purchase"].includes(
      kpi.id,
    );
  }

  const filteredTransactions = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return data.transactions.filter((sale) => {
      const matchesKeyword =
        !keyword ||
        [sale.invoiceNumber, sale.cashierName, sale.customerName, sale.paymentLabel, sale.formattedSubtotal]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesPayment = paymentFilter === "all" || sale.paymentMethod === paymentFilter;
      const matchesCashier = cashierFilter === "all" || sale.cashierName === cashierFilter;

      return matchesKeyword && matchesPayment && matchesCashier;
    });
  }, [cashierFilter, data.transactions, paymentFilter, query]);

  const selectedPaymentTransactions = useMemo(() => {
    if (selectedPaymentMethod === "all") {
      return data.transactions;
    }

    return data.transactions.filter(
      (sale) => sale.paymentMethod === selectedPaymentMethod,
    );
  }, [data.transactions, selectedPaymentMethod]);

  function applyPreset(preset: string) {
    const params = new URLSearchParams();
    params.set("preset", preset);

    if (preset === "custom") {
      params.set("from", from);
      params.set("to", to);
    }

    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  }

  function submitCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyPreset("custom");
    setShowMobileFilters(false);
  }

  function exportPdf() {
    setExporting(true);
    window.location.href = data.exportHref;
    window.setTimeout(() => setExporting(false), 1500);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filterForm = (
    <form onSubmit={submitCustom} className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,150px)_minmax(0,150px)_auto]">
      <input
        type="date"
        value={from}
        onChange={(event) => setFrom(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      <input
        type="date"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-[#fff] transition hover:bg-blue-700 active:scale-95"
      >
        Terapkan
      </button>
    </form>
  );

  const transactionFilters = (
    <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 min-[1180px]:grid-cols-[minmax(240px,1fr)_150px_150px]">
      <label className="relative sm:col-span-2 min-[1180px]:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari invoice, kasir, customer..."
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </label>
      <select
        value={paymentFilter}
        onChange={(event) => setPaymentFilter(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        <option value="all">Semua Payment</option>
        {data.paymentMethods.map((method) => (
          <option key={method} value={method}>{method}</option>
        ))}
      </select>
      <select
        value={cashierFilter}
        onChange={(event) => setCashierFilter(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        <option value="all">Semua Kasir</option>
        {data.cashiers.map((cashier) => (
          <option key={cashier} value={cashier}>{cashier}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="reports-page min-w-0 max-w-full overflow-x-hidden bg-[#f8fafc] pb-8 text-slate-900">
      <style>
        {`
          body:has(.reports-page) img[style*="position: fixed"][style*="right"],
          body:has(.reports-page) [style*="position: fixed"][style*="bottom"][style*="right"],
          body:has(.reports-page) [class~="fixed"][class*="bottom-"][class*="right-"],
          body:has(.reports-page) [class*="mascot"],
          body:has(.reports-page) [class*="Mascot"],
          body:has(.reports-page) [id*="mascot"],
          body:has(.reports-page) [id*="Mascot"],
          body:has(.reports-page) [class*="assistant"][class*="fixed"],
          body:has(.reports-page) [id*="assistant"][style*="fixed"],
          body:has(.reports-page) [class*="chat"][class*="fixed"][class*="right"],
          body:has(.reports-page) iframe[style*="position: fixed"][style*="right"] {
            display: none !important;
            pointer-events: none !important;
          }
        `}
      </style>
      <div className="mx-auto w-full max-w-[1680px] min-w-0 space-y-5">
        <header className="hidden min-w-0 items-start justify-between gap-5 md:flex">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Laporan Owner</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Ringkasan performa toko berdasarkan periode yang dipilih.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
              <Calendar className="h-4 w-4 text-blue-600" />
              {data.period.label}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Menyiapkan..." : "Export PDF"}
            </button>
          </div>
        </header>

        <header className="space-y-3 md:hidden">
          <div className="text-center">
            <h1 className="text-lg font-extrabold text-slate-950">Laporan Owner</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">Periode aktif: {data.period.label}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 shadow-sm">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="min-w-0 flex-1 truncate">{data.period.label}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowMobileFilters((value) => !value)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter Periode
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 shadow-sm disabled:opacity-60"
            >
              {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>
          </div>
        </header>

        {showMobileFilters ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-slate-950">Filter Periode</h2>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                aria-label="Tutup filter periode"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    applyPreset(preset.key);
                    if (preset.key !== "custom") setShowMobileFilters(false);
                  }}
                  className={cx(
                    "h-10 rounded-xl px-3 text-xs font-extrabold transition active:scale-95",
                    data.period.preset === preset.key
                      ? "bg-blue-600 text-[#fff]"
                      : "border border-slate-200 bg-white text-slate-700",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {filterForm}
          </section>
        ) : null}

        <section className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:block">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className={cx(
                    "h-10 rounded-xl px-4 text-sm font-extrabold transition hover:-translate-y-0.5 active:scale-95",
                    data.period.preset === preset.key
                      ? "bg-blue-600 text-[#fff] shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {filterForm}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700">
              Menampilkan data: {data.period.label}
            </span>
            {isPending ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Memuat data
              </span>
            ) : null}
          </div>
        </section>

        <nav className="hidden min-w-0 gap-1 overflow-x-auto border-b border-slate-200 md:flex">
          {desktopTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToSection(tab.id)}
              className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-extrabold text-slate-600 transition hover:border-blue-600 hover:text-blue-700"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="space-y-3 md:hidden">
          <MainKpiCard kpi={netKpi} onOpen={setSelectedKpi} />
          <div id="ringkasan-mobile" className="grid grid-cols-2 gap-3">
            {mobileKpis.map((kpi) => (
              <MetricCard
                key={kpi.id}
                kpi={kpi}
                compact
                onOpen={canOpenKpi(kpi) ? setSelectedKpi : undefined}
              />
            ))}
          </div>
        </div>

        <div id="ringkasan" className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3 min-[1500px]:grid-cols-4 min-[1800px]:grid-cols-7">
          {data.kpis.map((kpi) => (
            <MetricCard
              key={kpi.id}
              kpi={kpi}
              onOpen={canOpenKpi(kpi) ? setSelectedKpi : undefined}
            />
          ))}
        </div>

        <div className="hidden gap-5 min-[1500px]:grid min-[1500px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.95fr)]">
          <ReportSectionCard
            id="penjualan"
            title="Trend Penjualan (Omzet Bersih)"
            action={
              <button
                type="button"
                onClick={() => setShowTrendDetail(true)}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                aria-label="Buka detail trend penjualan"
              >
                Lihat detail <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setShowTrendDetail(true)}
              className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              aria-label="Buka detail trend penjualan"
            >
              <TrendChart rows={data.trend} />
            </button>
          </ReportSectionCard>
          <ReportSectionCard
            id="pembayaran"
            title="Ringkasan Pembayaran"
            action={
              <button
                type="button"
                onClick={() => setShowPaymentDetail(true)}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                aria-label="Buka detail pembayaran"
              >
                Lihat detail <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setShowPaymentDetail(true)}
              className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              aria-label="Buka detail pembayaran"
            >
              <PaymentSummary payments={data.payments} total={data.paymentTotal} desktopDonut />
            </button>
          </ReportSectionCard>
          <ReportSectionCard
            id="produk"
            title="Produk Terlaris (Top 5)"
            action={
              <Link href="/products" className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <TopProducts products={data.bestSellers} onSelect={setSelectedProduct} />
          </ReportSectionCard>
        </div>

        <div className="hidden gap-5 md:grid min-[1500px]:hidden">
          <ReportSectionCard
            id="penjualan"
            title="Trend Penjualan (Omzet Bersih)"
            action={
              <button
                type="button"
                onClick={() => setShowTrendDetail(true)}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                aria-label="Buka detail trend penjualan"
              >
                Lihat detail <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setShowTrendDetail(true)}
              className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              aria-label="Buka detail trend penjualan"
            >
              <TrendChart rows={data.trend} />
            </button>
          </ReportSectionCard>
          <div className="grid gap-5 min-[1500px]:grid-cols-2">
            <ReportSectionCard
              id="pembayaran"
              title="Ringkasan Pembayaran"
              action={
                <button
                  type="button"
                  onClick={() => setShowPaymentDetail(true)}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  aria-label="Buka detail pembayaran"
                >
                  Lihat detail <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              }
            >
              <button
                type="button"
                onClick={() => setShowPaymentDetail(true)}
                className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                aria-label="Buka detail pembayaran"
              >
                <PaymentSummary payments={data.payments} total={data.paymentTotal} />
              </button>
            </ReportSectionCard>
            <ReportSectionCard id="produk" title="Produk Terlaris (Top 5)">
              <TopProducts products={data.bestSellers} onSelect={setSelectedProduct} />
            </ReportSectionCard>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
          <h2 className="text-lg font-extrabold text-slate-950">Statistik & Diagram</h2>
          <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={cx(
                  "h-9 shrink-0 rounded-full px-4 text-xs font-extrabold transition active:scale-95",
                  mobileTab === tab.id
                    ? "bg-blue-600 text-[#fff]"
                    : "border border-slate-200 bg-white text-slate-700",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-5 min-w-0">
            {mobileTab === "penjualan" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-slate-950">Trend Penjualan (Omzet Bersih)</h3>
                  <button
                    type="button"
                    onClick={() => setShowTrendDetail(true)}
                    className="shrink-0 text-xs font-extrabold text-blue-700"
                    aria-label="Buka detail trend penjualan"
                  >
                    Lihat detail
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrendDetail(true)}
                  className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  aria-label="Buka detail trend penjualan"
                >
                  <TrendChart rows={data.trend} compact />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <InsightBox label="Total Omzet" value={rupiahCompact(trendTotal)} />
                  <InsightBox label="Rata-rata / hari" value={rupiahCompact(Math.round(trendTotal / Math.max(data.trend.length, 1)))} />
                  <InsightBox label="Hari terbaik" value={bestTrendDay.label} />
                  <InsightBox label="Transaksi" value={String(trendTransactions)} />
                </div>
              </div>
            ) : null}
            {mobileTab === "pembayaran" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-slate-950">Ringkasan Pembayaran</h3>
                  <button
                    type="button"
                    onClick={() => setShowPaymentDetail(true)}
                    className="shrink-0 text-xs font-extrabold text-blue-700"
                    aria-label="Buka detail pembayaran"
                  >
                    Lihat detail
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentDetail(true)}
                  className="w-full cursor-pointer rounded-2xl text-left transition hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  aria-label="Buka detail pembayaran"
                >
                  <PaymentSummary payments={data.payments} total={data.paymentTotal} />
                </button>
              </div>
            ) : null}
            {mobileTab === "produk" ? (
              <TopProducts
                products={data.bestSellers}
                mobile
                onSelect={setSelectedProduct}
              />
            ) : null}
            {mobileTab === "retur" ? <ReturnSummary summary={data.returnSummary} /> : null}
            {mobileTab === "stok" ? <LowStockList rows={data.lowStock} mobile /> : null}
            {mobileTab === "bulanan" ? <MonthlySummary summary={data.monthlySummary} mobile /> : null}
          </div>
        </section>

        <div className="hidden gap-5 md:grid min-[1500px]:grid-cols-3">
          <ReportSectionCard
            id="transaksi"
            title="Transaksi Terakhir"
            action={
              <Link href="/sales" className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
            className="xl:col-span-1"
          >
            <div className="mb-4">
              {transactionFilters}
            </div>
            <RecentTransactions
              rows={filteredTransactions}
              onSelect={setSelectedTransaction}
            />
          </ReportSectionCard>
          <ReportSectionCard
            id="retur"
            title="Retur Summary"
            action={
              <Link href="/returns" className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <ReturnSummary summary={data.returnSummary} />
          </ReportSectionCard>
          <ReportSectionCard
            id="stok"
            title="Stok Rendah (<= Minimum Stok)"
            action={
              <Link href="/products" className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <LowStockList rows={data.lowStock} />
          </ReportSectionCard>
        </div>

        <ReportSectionCard id="transaksi-mobile" title="Transaksi Terakhir" className="md:hidden">
          <div className="mb-4">
            {transactionFilters}
          </div>
          <RecentTransactions
            rows={filteredTransactions}
            mobile
            onSelect={setSelectedTransaction}
          />
        </ReportSectionCard>

        <div className="hidden gap-5 md:grid lg:grid-cols-2">
          <ReportSectionCard id="pembelian" title="Pembelian Periode Ini">
            <PurchasesList rows={data.recentPurchases} />
          </ReportSectionCard>
          <ReportSectionCard id="laba-margin" title="Laba & Margin">
            <ProfitSummary summary={data.profitSummary} />
          </ReportSectionCard>
        </div>

        <ReportSectionCard id="bulanan" title={data.monthlySummary.title}>
          <MonthlySummary summary={data.monthlySummary} />
        </ReportSectionCard>

        <section className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          Data pada laporan ini mengikuti periode yang dipilih. Pastikan semua transaksi sudah selesai/closing untuk hasil yang akurat.
        </section>

        {selectedKpi ? (
          <ReportModal title={selectedKpi.title} onClose={() => setSelectedKpi(null)}>
            <KpiDetailContent
              kpi={selectedKpi}
              data={data}
              onSelectProduct={(product) => {
                setSelectedKpi(null);
                setSelectedProduct(product);
              }}
              onSelectTransaction={(transaction) => {
                setSelectedKpi(null);
                setSelectedTransaction(transaction);
              }}
            />
          </ReportModal>
        ) : null}

        {selectedProduct ? (
          <ReportModal title="Detail Produk" onClose={() => setSelectedProduct(null)}>
            <ProductDetailContent product={selectedProduct} />
          </ReportModal>
        ) : null}

        {selectedTransaction ? (
          <ReportModal
            title="Detail Transaksi"
            onClose={() => setSelectedTransaction(null)}
          >
            <TransactionDetailContent transaction={selectedTransaction} />
          </ReportModal>
        ) : null}

        {showTrendDetail ? (
          <ReportModal
            title="Detail Trend Penjualan"
            onClose={() => setShowTrendDetail(false)}
            panelClassName="max-w-5xl"
          >
            <TrendDetailContent
              periodLabel={data.period.label}
              rows={data.trend}
            />
          </ReportModal>
        ) : null}

        {showPaymentDetail ? (
          <ReportModal
            title="Detail Pembayaran"
            onClose={() => setShowPaymentDetail(false)}
            panelClassName="max-w-4xl"
          >
            <PaymentDetailContent
              payments={data.payments}
              paymentTotal={data.paymentTotal}
              reconciliation={data.reconciliation}
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
              transactions={selectedPaymentTransactions}
              onSelectTransaction={(transaction) => {
                setShowPaymentDetail(false);
                setSelectedTransaction(transaction);
              }}
            />
          </ReportModal>
        ) : null}
      </div>
    </div>
  );
}

function ReportModal({
  title,
  onClose,
  children,
  panelClassName,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
      <div className={cx("w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl", panelClassName ?? "max-w-2xl")}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-95"
            aria-label="Tutup detail laporan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function KpiDetailContent({
  kpi,
  data,
  onSelectProduct,
  onSelectTransaction,
}: {
  kpi: KpiCard;
  data: OwnerReportViewData;
  onSelectProduct: (product: ProductRow) => void;
  onSelectTransaction: (sale: TransactionRow) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {kpi.rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-4 rounded-xl border border-slate-100 p-4"
          >
            <span className="text-sm font-semibold text-slate-500">{row.label}</span>
            <strong
              className={cx(
                "text-right text-sm tabular-nums",
                row.tone === "danger"
                  ? "text-rose-700"
                  : row.tone === "good"
                    ? "text-emerald-700"
                    : "text-slate-950",
              )}
            >
              {row.value}
            </strong>
          </div>
        ))}
      </div>

      {kpi.id === "transactions" ? (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-950">
            Transaksi periode ini
          </h3>
          <RecentTransactions rows={data.transactions} mobile onSelect={onSelectTransaction} />
        </div>
      ) : null}

      {kpi.id === "products-sold" ? (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-950">
            Produk terjual/top products
          </h3>
          <TopProducts products={data.bestSellers} mobile onSelect={onSelectProduct} />
        </div>
      ) : null}

      {kpi.id === "returns" ? <ReturnSummary summary={data.returnSummary} /> : null}
      {kpi.id === "purchase" ? <PurchasesList rows={data.recentPurchases} /> : null}
      {["gross", "net", "atv"].includes(kpi.id) ? (
        <div className="rounded-2xl border border-slate-100 p-3">
          <TrendChart rows={data.trend} compact />
        </div>
      ) : null}
    </div>
  );
}

function ProductDetailContent({ product }: { product: ProductRow }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-extrabold text-slate-950">{product.name}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{product.sku || "-"}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <InsightBox label="Qty Terjual" value={String(product.qty)} />
        <InsightBox label="Omzet" value={product.formattedTotal} />
        <InsightBox label="Stok Tersisa" value={String(product.stock)} />
      </div>
      <Link
        href={`/products?q=${encodeURIComponent(product.sku || product.name)}`}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-[#fff] transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-[0.99]"
      >
        Lihat Detail Produk
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function TransactionDetailContent({
  transaction,
}: {
  transaction: TransactionRow;
}) {
  const rows = [
    ["Invoice", transaction.invoiceNumber],
    ["Tanggal", transaction.createdAtLabel],
    ["Kasir", transaction.cashierName],
    ["Customer", transaction.customerName],
    ["Item", `${transaction.itemCount} item`],
    ["Pembayaran", transaction.paymentLabel],
    ["Payment Status", transaction.paymentStatus],
    ["Transaction Status", transaction.transactionStatus],
    ["Total", transaction.formattedSubtotal],
    ["Retur", transaction.returnCount > 0 ? "Ada retur" : "-"],
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-4 rounded-xl border border-slate-100 p-4"
          >
            <span className="text-sm font-semibold text-slate-500">{label}</span>
            <strong className="text-right text-sm text-slate-950">{value}</strong>
          </div>
        ))}
      </div>
      {transaction.id ? (
        <Link
          href={`/invoices/${transaction.id}`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-[#fff] transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-[0.99]"
        >
          Buka Invoice
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          Detail transaksi belum tersedia.
        </div>
      )}
    </div>
  );
}

function TrendDetailContent({
  periodLabel,
  rows,
}: {
  periodLabel: string;
  rows: TrendRow[];
}) {
  const hasTrend = rows.length > 0 && rows.some((row) => row.omzet > 0 || row.transactions > 0);
  const totalOmzet = rows.reduce((total, row) => total + row.omzet, 0);
  const totalTransactions = rows.reduce((total, row) => total + row.transactions, 0);
  const averagePerDay = rows.length > 0 ? Math.round(totalOmzet / rows.length) : 0;
  const bestDay = rows.reduce(
    (best, row) => (row.omzet > best.omzet ? row : best),
    rows[0] ?? { label: "-", omzet: 0, transactions: 0 },
  );

  if (!hasTrend) {
    return <EmptyState label="Data trend penjualan belum tersedia." />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
        Periode aktif: {periodLabel}
      </div>
      <div className="rounded-2xl border border-slate-100 p-4">
        <TrendChart rows={rows} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Total Omzet" value={rupiahCompact(totalOmzet)} />
        <InsightBox label="Rata-rata / hari" value={rupiahCompact(averagePerDay)} />
        <InsightBox label="Hari terbaik" value={bestDay.label} />
        <InsightBox label="Total transaksi" value={String(totalTransactions)} />
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[620px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[180px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-right">Omzet</th>
              <th className="px-4 py-3 text-right">Jumlah transaksi</th>
              <th className="px-4 py-3 text-right">ATV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td className="px-4 py-3 font-bold text-slate-700">{row.label}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
                  {rupiahCompact(row.omzet)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-700">
                  {row.transactions}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-700">
                  {row.transactions > 0
                    ? rupiahCompact(Math.round(row.omzet / row.transactions))
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentDetailContent({
  payments,
  paymentTotal,
  reconciliation,
  selectedMethod,
  onSelectMethod,
  transactions,
  onSelectTransaction,
}: {
  payments: PaymentRow[];
  paymentTotal: string;
  reconciliation: OwnerReportViewData["reconciliation"];
  selectedMethod: string;
  onSelectMethod: (method: string) => void;
  transactions: TransactionRow[];
  onSelectTransaction: (sale: TransactionRow) => void;
}) {
  if (!payments.length) {
    return <EmptyState label="Belum ada pembayaran pada periode ini." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightBox label="Total Pembayaran" value={paymentTotal} />
        <InsightBox label="Omzet Bersih Terkait" value={reconciliation.netOmzet} />
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onSelectMethod("all")}
          className={cx(
            "w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
            selectedMethod === "all"
              ? "border-blue-200 bg-blue-50"
              : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40",
          )}
          aria-label="Tampilkan semua transaksi pembayaran"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-extrabold text-slate-950">Semua metode</span>
            <span className="text-sm font-extrabold tabular-nums text-slate-950">
              {paymentTotal}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">Reset filter metode bayar</p>
        </button>
        {payments.map((payment) => (
          <button
            key={payment.method}
            type="button"
            onClick={() => onSelectMethod(payment.method)}
            className={cx(
              "w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
              selectedMethod === payment.method
                ? "border-blue-200 bg-blue-50"
                : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40",
            )}
            aria-label={`Tampilkan transaksi metode ${payment.label}`}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-950">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: payment.color }}
                />
                <span className="truncate">{payment.label}</span>
              </span>
              <span className="whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-slate-950">
                {payment.formattedTotal}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(payment.percent, 2)}%`,
                  backgroundColor: payment.color,
                }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {payment.transactions} transaksi - {payment.percent.toFixed(1)}%
            </p>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-950">
          Transaksi metode terpilih
        </h3>
        {transactions.length > 0 ? (
          <RecentTransactions
            rows={transactions}
            mobile
            onSelect={onSelectTransaction}
          />
        ) : (
          <EmptyState label="Detail transaksi pembayaran belum tersedia." />
        )}
      </div>
    </div>
  );
}

function InsightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
