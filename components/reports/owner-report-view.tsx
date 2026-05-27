"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import ClientPaginationControl from "@/components/ui/client-pagination-control";
import { downloadOwnerReportPdf } from "@/components/reports/download-owner-report-pdf";
import { formatDateID, parseIDDateInput } from "@/lib/date-format";
import { operatorLabel, transactionIdentityLabel } from "@/lib/transaction-identity";

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
  cashierRoleName?: string | null;
  cashierRoleSlug?: string | null;
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

type MonthlyTrendRow = {
  key: string;
  label: string;
  omzet: number;
  transactions: number;
  days: number;
  dailyRows: TrendRow[];
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
  itemCount: number;
  totalQty: number;
  total: string;
  createdBy: string | null;
  notes: string | null;
  items: {
    id: string;
    product: string;
    sku: string;
    category: string | null;
    qty: number;
    costPrice: string;
    subtotal: string;
    stockBefore: number | null;
    stockAfter: number | null;
    notes: string | null;
  }[];
};

type ProfitProductRow = {
  productId: number;
  name: string;
  sku: string;
  category: string | null;
  soldQty: number;
  returnQty: number;
  netQty: number;
  grossRevenue: string;
  returnRevenue: string;
  netRevenue: string;
  salesCogs: string;
  returnCogs: string;
  netCogs: string;
  revenue: string;
  cogs: string;
  profit: string;
  margin: string;
  marginValue: number | null;
  status: "HPP belum lengkap" | "Cek HPP retur" | "Rugi" | "Margin rendah" | "Sehat";
  marginValid: boolean;
  sales: {
    invoiceNumber: string;
    createdAt: string;
    qty: number;
    revenue: string;
    cogs: string;
    profit: string;
    margin: string;
    paymentMethod: string;
  }[];
  returns: {
    invoiceNumber: string;
    createdAt: string;
    qty: number;
    revenue: string;
    cogs: string;
    reason: string;
    paymentMethod: string;
  }[];
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
    products: ProfitProductRow[];
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
  { key: "this-month", label: "Bulan Ini" },
  { key: "last-month", label: "Bulan Lalu" },
  { key: "this-year", label: "Tahun Ini" },
  { key: "last-year", label: "Tahun Lalu" },
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
] as const;

type DesktopReportTabId = (typeof desktopTabs)[number]["id"];

const REPORT_SECTION_PREFERENCE_KEY = "owner-report-active-section";

function isDesktopReportTabId(value: string | null): value is DesktopReportTabId {
  return desktopTabs.some((tab) => tab.id === value);
}

const mobileTabs = [
  { id: "penjualan", label: "Penjualan" },
  { id: "pembayaran", label: "Pembayaran" },
  { id: "produk", label: "Produk" },
  { id: "retur", label: "Retur" },
  { id: "stok", label: "Stok" },
  { id: "bulanan", label: "Bulanan" },
] as const;

type MobileStatsTab = (typeof mobileTabs)[number]["id"];

const REPORT_DETAIL_PAGE_SIZE = 7;
const PROFIT_STATUS_FILTERS = [
  "Semua",
  "Sehat",
  "HPP belum lengkap",
  "Cek HPP retur",
  "Rugi",
  "Margin rendah",
] as const;
const TOKEN_KEY = "fishing_pos_token";

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

function ownerReportPdfFilename(period: OwnerReportViewData["period"]) {
  return period.from === period.to
    ? `owner-report-${period.from}.pdf`
    : `owner-report-${period.from}-to-${period.to}.pdf`;
}

function compareIsoDate(from: string, to: string) {
  return from.localeCompare(to);
}

function ReportPeriodFilter({
  from,
  to,
  onSubmit,
}: {
  from: string;
  to: string;
  onSubmit: (range: { from: string; to: string }) => void;
}) {
  const [fromInput, setFromInput] = useState(formatDateID(from));
  const [toInput, setToInput] = useState(formatDateID(to));
  const [error, setError] = useState<string | null>(null);

  function submitCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedFrom = parseIDDateInput(fromInput);
    const parsedTo = parseIDDateInput(toInput);

    if (!parsedFrom || !parsedTo) {
      setError("Tanggal custom wajib memakai format dd/mm/yyyy, contoh 15/05/2026.");
      return;
    }

    if (compareIsoDate(parsedFrom, parsedTo) > 0) {
      setError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
      return;
    }

    setError(null);
    setFromInput(formatDateID(parsedFrom));
    setToInput(formatDateID(parsedTo));
    onSubmit({ from: parsedFrom, to: parsedTo });
  }

  return (
    <form onSubmit={submitCustom} className="min-w-0 space-y-2">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,150px)_minmax(0,150px)_auto]">
        <input
          type="text"
          inputMode="numeric"
          value={fromInput}
          onChange={(event) => {
            setFromInput(event.target.value);
            setError(null);
          }}
          onBlur={() => {
            const parsed = parseIDDateInput(fromInput);
            if (parsed) setFromInput(formatDateID(parsed));
          }}
          placeholder="dd/mm/yyyy"
          aria-label="Tanggal awal laporan"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <input
          type="text"
          inputMode="numeric"
          value={toInput}
          onChange={(event) => {
            setToInput(event.target.value);
            setError(null);
          }}
          onBlur={() => {
            const parsed = parseIDDateInput(toInput);
            if (parsed) setToInput(formatDateID(parsed));
          }}
          placeholder="dd/mm/yyyy"
          aria-label="Tanggal akhir laporan"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-[#fff] transition hover:bg-blue-700 active:scale-95"
        >
          Terapkan
        </button>
      </div>
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
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
    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center dark:border-slate-800 dark:bg-slate-900">
      <PackageOpen className="h-7 w-7 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
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
        "min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 md:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 break-words text-base font-extrabold leading-tight text-slate-950 dark:text-slate-100 md:text-lg">
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
    <div className={cx("min-w-0", desktopDonut && "space-y-5")}>
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
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: payment.color }} />
                <span className="min-w-0 break-words text-sm font-bold text-slate-700">{payment.label}</span>
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <p className="text-sm font-extrabold tabular-nums text-slate-950">
                  {payment.formattedTotal}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {payment.transactions} transaksi
                </p>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(payment.percent, 2)}%`, backgroundColor: payment.color }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Kontribusi {payment.percent.toFixed(1)}%
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
  limit,
  onSelect,
}: {
  rows: TransactionRow[];
  mobile?: boolean;
  limit?: number;
  onSelect?: (sale: TransactionRow) => void;
}) {
  if (!rows.length) return <EmptyState label="Tidak ada transaksi pada periode ini." />;

  if (mobile) {
    const visibleRows = rows.slice(0, limit ?? 5);

    return (
      <div className="space-y-3">
        {visibleRows.map((sale) => (
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
                  {sale.createdAtLabel} • {transactionIdentityLabel({
                    operator: {
                      name: sale.cashierName,
                      role: {
                        name: sale.cashierRoleName,
                        slug: sale.cashierRoleSlug,
                      },
                    },
                    customer: { name: sale.customerName },
                  })} • {sale.itemCount} item
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
            <th className="px-4 py-3">Operator</th>
            <th className="px-4 py-3 text-right">Item</th>
            <th className="px-4 py-3">Pembayaran</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, limit ?? 6).map((sale) => (
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
                <span className="block truncate font-semibold text-slate-700" title={operatorLabel({
                  name: sale.cashierName,
                  role: {
                    name: sale.cashierRoleName,
                    slug: sale.cashierRoleSlug,
                  },
                })}>
                  {operatorLabel({
                    name: sale.cashierName,
                    role: {
                      name: sale.cashierRoleName,
                      slug: sale.cashierRoleSlug,
                    },
                  })}
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
        <div key={purchase.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800">
          <div className="min-w-0">
            <p className="truncate font-extrabold text-slate-950 dark:text-slate-100">{purchase.number}</p>
            <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{purchase.date} - {purchase.supplier}</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
              {purchase.itemCount} item - Total Qty {purchase.totalQty}
            </p>
          </div>
          <strong className="text-right tabular-nums text-slate-950 dark:text-slate-100">{purchase.total}</strong>
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
          <div key={item.label} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-slate-100">{item.value}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800">
          <div className="flex justify-between gap-3">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Omzet kotor</span>
            <strong className="tabular-nums text-slate-950 dark:text-slate-100">{summary.grossRevenue}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Retur customer</span>
            <strong className="tabular-nums text-rose-700">{summary.returnRevenue}</strong>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800">
          <div className="flex justify-between gap-3">
            <span className="font-semibold text-slate-500 dark:text-slate-400">HPP penjualan</span>
            <strong className="tabular-nums text-slate-950 dark:text-slate-100">{summary.salesCogs}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="font-semibold text-slate-500 dark:text-slate-400">HPP retur</span>
            <strong className="tabular-nums text-rose-700">{summary.returnCogs}</strong>
          </div>
        </div>
      </div>

      {summary.topProducts.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3">Produk</th>
                <th className="px-3 py-3 text-right">Qty Net</th>
                <th className="px-3 py-3 text-right">Omzet</th>
                <th className="px-3 py-3 text-right">HPP</th>
                <th className="px-3 py-3 text-right">Laba</th>
                <th className="px-3 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.topProducts.map((item) => (
                <tr key={item.productId}>
                  <td className="px-3 py-3">
                    <p className="font-extrabold text-slate-950 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.sku}</p>
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">{item.netQty}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{item.netRevenue}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{item.netCogs}</td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{item.profit}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    {item.marginValid ? item.margin : "Tidak valid"}
                  </td>
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
  const [showPurchaseDetail, setShowPurchaseDetail] = useState(false);
  const [showProfitDetail, setShowProfitDetail] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [activeReportSection, setActiveReportSection] =
    useState<DesktopReportTabId>("ringkasan");

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

  function applyPreset(
    preset: string,
    customRange?: { from: string; to: string },
  ) {
    const params = new URLSearchParams();
    params.set("preset", preset);

    if (preset === "custom") {
      params.set("from", customRange?.from ?? data.period.from);
      params.set("to", customRange?.to ?? data.period.to);
    }

    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  }

  function submitCustom(range: { from: string; to: string }) {
    applyPreset("custom", range);
    setShowMobileFilters(false);
  }

  async function exportPdf() {
    setExporting(true);

    try {
      await downloadOwnerReportPdf(
        data.exportHref,
        ownerReportPdfFilename(data.period),
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Export PDF gagal.",
      );
    } finally {
      setExporting(false);
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedSection = window.localStorage.getItem(REPORT_SECTION_PREFERENCE_KEY);

      if (isDesktopReportTabId(savedSection)) {
        setActiveReportSection(savedSection);

        if (savedSection !== "ringkasan") {
          scrollToSection(savedSection);
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function selectReportSection(sectionId: DesktopReportTabId) {
    setActiveReportSection(sectionId);
    window.localStorage.setItem(REPORT_SECTION_PREFERENCE_KEY, sectionId);
    scrollToSection(sectionId);
  }

  const filterForm = (
    <ReportPeriodFilter
      key={`${data.period.from}-${data.period.to}`}
      from={data.period.from}
      to={data.period.to}
      onSubmit={submitCustom}
    />
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
        <option value="all">Semua Operator</option>
        {data.cashiers.map((cashier) => (
          <option key={cashier} value={cashier}>{cashier}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="reports-page min-w-0 max-w-full overflow-x-hidden bg-[#f8fafc] pb-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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

          .dark .reports-page {
            background:
              radial-gradient(circle at top right, rgba(20, 184, 166, 0.08), transparent 28rem),
              #020617;
            color: #e2e8f0;
          }

          .dark .reports-page [class~="bg-white"] {
            background-color: rgba(2, 6, 23, 0.72) !important;
          }

          .dark .reports-page [class~="bg-slate-50"],
          .dark .reports-page [class~="bg-slate-50/70"],
          .dark .reports-page [class~="bg-gray-50"] {
            background-color: rgba(15, 23, 42, 0.74) !important;
          }

          .dark .reports-page [class~="bg-slate-100"],
          .dark .reports-page [class~="bg-gray-100"] {
            background-color: rgba(30, 41, 59, 0.9) !important;
          }

          .dark .reports-page [class~="border-slate-200"],
          .dark .reports-page [class~="border-slate-100"],
          .dark .reports-page [class~="border-gray-200"] {
            border-color: rgba(30, 41, 59, 0.95) !important;
          }

          .dark .reports-page [class~="divide-slate-100"] > :not([hidden]) ~ :not([hidden]),
          .dark .reports-page [class~="divide-slate-200"] > :not([hidden]) ~ :not([hidden]) {
            border-color: rgba(30, 41, 59, 0.95) !important;
          }

          .dark .reports-page [class~="text-slate-950"],
          .dark .reports-page [class~="text-slate-900"],
          .dark .reports-page [class~="text-black"] {
            color: #f8fafc !important;
          }

          .dark .reports-page [class~="text-slate-800"],
          .dark .reports-page [class~="text-slate-700"],
          .dark .reports-page [class~="text-gray-800"],
          .dark .reports-page [class~="text-gray-700"] {
            color: #cbd5e1 !important;
          }

          .dark .reports-page [class~="text-slate-600"],
          .dark .reports-page [class~="text-slate-500"],
          .dark .reports-page [class~="text-gray-600"],
          .dark .reports-page [class~="text-gray-500"] {
            color: #94a3b8 !important;
          }

          .dark .reports-page [class~="text-slate-400"],
          .dark .reports-page [class~="text-gray-400"] {
            color: #64748b !important;
          }

          .dark .reports-page [class~="bg-emerald-50"] {
            background-color: rgba(16, 185, 129, 0.14) !important;
          }

          .dark .reports-page [class~="text-emerald-700"],
          .dark .reports-page [class~="text-emerald-600"] {
            color: #a7f3d0 !important;
          }

          .dark .reports-page [class~="border-emerald-100"] {
            border-color: rgba(16, 185, 129, 0.28) !important;
          }

          .dark .reports-page [class~="bg-blue-50"] {
            background-color: rgba(37, 99, 235, 0.16) !important;
          }

          .dark .reports-page [class~="text-blue-700"],
          .dark .reports-page [class~="text-blue-600"] {
            color: #93c5fd !important;
          }

          .dark .reports-page [class~="border-blue-100"],
          .dark .reports-page [class~="border-blue-200"] {
            border-color: rgba(59, 130, 246, 0.34) !important;
          }

          .dark .reports-page [class~="bg-violet-50"] {
            background-color: rgba(124, 58, 237, 0.16) !important;
          }

          .dark .reports-page [class~="text-violet-700"] {
            color: #c4b5fd !important;
          }

          .dark .reports-page [class~="border-violet-100"] {
            border-color: rgba(124, 58, 237, 0.34) !important;
          }

          .dark .reports-page [class~="bg-rose-50"] {
            background-color: rgba(244, 63, 94, 0.14) !important;
          }

          .dark .reports-page [class~="text-rose-700"],
          .dark .reports-page [class~="text-rose-600"] {
            color: #fda4af !important;
          }

          .dark .reports-page [class~="border-rose-100"],
          .dark .reports-page [class~="border-rose-200"] {
            border-color: rgba(244, 63, 94, 0.32) !important;
          }

          .dark .reports-page [class~="bg-orange-50"],
          .dark .reports-page [class~="bg-amber-50"] {
            background-color: rgba(245, 158, 11, 0.14) !important;
          }

          .dark .reports-page [class~="text-orange-700"],
          .dark .reports-page [class~="text-amber-700"],
          .dark .reports-page [class~="text-amber-800"] {
            color: #fcd34d !important;
          }

          .dark .reports-page [class~="border-orange-100"],
          .dark .reports-page [class~="border-amber-200"] {
            border-color: rgba(245, 158, 11, 0.32) !important;
          }

          .dark .reports-page [class~="shadow-sm"],
          .dark .reports-page [class~="shadow-md"],
          .dark .reports-page [class~="shadow-lg"],
          .dark .reports-page [class~="shadow-2xl"] {
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22) !important;
          }

          .dark .reports-page input,
          .dark .reports-page select,
          .dark .reports-page textarea {
            color-scheme: dark;
            background-color: rgba(15, 23, 42, 0.92) !important;
            border-color: rgba(51, 65, 85, 0.95) !important;
            color: #f8fafc !important;
          }

          .dark .reports-page input::placeholder,
          .dark .reports-page textarea::placeholder {
            color: #64748b !important;
          }

          .dark .reports-page table thead {
            background-color: rgba(15, 23, 42, 0.9) !important;
            color: #94a3b8 !important;
          }

          .dark .reports-page tr:hover,
          .dark .reports-page button[class*="hover:bg-blue-50"]:hover {
            background-color: rgba(37, 99, 235, 0.08);
          }

          .dark .reports-page svg text {
            fill: #cbd5e1;
          }

          .dark .reports-page svg line[stroke="#e2e8f0"] {
            stroke: #334155;
          }

          .dark .reports-page svg [fill="#475569"] {
            fill: #cbd5e1;
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
              onClick={() => selectReportSection(tab.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-extrabold transition",
                activeReportSection === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:border-blue-600 hover:text-blue-700",
              )}
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

        <div className="hidden gap-5 md:grid min-[1500px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.95fr)]">
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
          <ReportSectionCard
            id="pembelian"
            title="Pembelian Periode Ini"
            action={
              <button
                type="button"
                onClick={() => setShowPurchaseDetail(true)}
                className="shrink-0 whitespace-nowrap text-xs font-extrabold text-blue-700 dark:text-blue-300"
              >
                Lihat semua
              </button>
            }
          >
            <PurchasesList rows={data.recentPurchases} />
          </ReportSectionCard>
          <ReportSectionCard
            id="laba-margin"
            title="Laba & Margin"
            action={
              <button
                type="button"
                onClick={() => setShowProfitDetail(true)}
                className="shrink-0 whitespace-nowrap text-xs font-extrabold text-blue-700 dark:text-blue-300"
              >
                Lihat detail
              </button>
            }
          >
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
              key={data.period.label}
              periodLabel={data.period.label}
              rows={data.trend}
              transactions={data.transactions}
              returnRecords={data.returnSummary.recentCustomer}
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
              key={`${data.period.label}-${selectedPaymentMethod}`}
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

        {showPurchaseDetail ? (
          <ReportModal
            title="Detail Pembelian Periode Ini"
            onClose={() => {
              setShowPurchaseDetail(false);
              setSelectedPurchase(null);
            }}
            panelClassName="max-w-6xl"
          >
            <PurchaseDetailContent
              key={data.period.label}
              purchases={data.recentPurchases}
              selectedPurchase={selectedPurchase}
              onSelectPurchase={setSelectedPurchase}
            />
          </ReportModal>
        ) : null}

        {showProfitDetail ? (
          <ReportModal
            title="Detail Laba & Margin"
            onClose={() => {
              setShowProfitDetail(false);
            }}
            panelClassName="max-w-7xl"
            subtitle={`Periode detail: ${data.period.label}`}
          >
            <ProfitDetailContent
              key={data.period.label}
              initialSummary={data.profitSummary}
              initialPeriod={data.period}
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
  subtitle,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
      <div className={cx("flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:max-h-[90vh] sm:rounded-2xl", panelClassName ?? "max-w-2xl")}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-extrabold text-slate-950 dark:text-slate-100">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:scale-95 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Tutup detail laporan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
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
    ["Operator", operatorLabel({
      name: transaction.cashierName,
      role: {
        name: transaction.cashierRoleName,
        slug: transaction.cashierRoleSlug,
      },
    })],
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

const ID_MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function parseTrendLabelDate(label: string) {
  const match = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { day, month, year };
}

function groupTrendRowsByMonth(rows: TrendRow[]) {
  const monthMap = new Map<string, MonthlyTrendRow>();

  for (const row of rows) {
    const parsedDate = parseTrendLabelDate(row.label);

    if (!parsedDate) {
      continue;
    }

    const key = `${parsedDate.year}-${String(parsedDate.month).padStart(2, "0")}`;
    const existing = monthMap.get(key);

    if (existing) {
      existing.omzet += row.omzet;
      existing.transactions += row.transactions;
      existing.days += 1;
      existing.dailyRows.push(row);
      continue;
    }

    monthMap.set(key, {
      key,
      label: `${ID_MONTH_NAMES[parsedDate.month - 1]} ${parsedDate.year}`,
      omzet: row.omzet,
      transactions: row.transactions,
      days: 1,
      dailyRows: [row],
    });
  }

  return Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function TrendDetailContent({
  periodLabel,
  rows,
  transactions,
  returnRecords,
}: {
  periodLabel: string;
  rows: TrendRow[];
  transactions: TransactionRow[];
  returnRecords: ReturnRecord[];
}) {
  const [page, setPage] = useState(1);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string | null>(null);
  const monthlyRows = useMemo(() => groupTrendRowsByMonth(rows), [rows]);
  const selectedMonth =
    monthlyRows.find((row) => row.key === selectedMonthKey) ?? null;
  const tableRows = selectedMonth ? selectedMonth.dailyRows : monthlyRows;
  const selectedDay =
    selectedMonth?.dailyRows.find((row) => row.label === selectedDayLabel) ?? null;
  const dayTransactions = useMemo(
    () =>
      selectedDay
        ? transactions.filter(
            (transaction) => formatDateID(transaction.createdAt) === selectedDay.label,
          )
        : [],
    [selectedDay, transactions],
  );
  const dayReturnRecords = selectedDay
    ? returnRecords.filter((record) => record.date === selectedDay.label)
    : [];
  const chartRows = selectedMonth
    ? selectedMonth.dailyRows
    : monthlyRows.map((row) => ({
        label: row.label,
        omzet: row.omzet,
        transactions: row.transactions,
      }));
  const hasTrend =
    monthlyRows.length > 0 &&
    monthlyRows.some((row) => row.omzet > 0 || row.transactions > 0);
  const totalOmzet = tableRows.reduce((total, row) => total + row.omzet, 0);
  const totalTransactions = tableRows.reduce(
    (total, row) => total + row.transactions,
    0,
  );
  const averageDenominator = selectedMonth ? selectedMonth.days : monthlyRows.length;
  const averageValue =
    averageDenominator > 0 ? Math.round(totalOmzet / averageDenominator) : 0;
  const bestRow = tableRows.reduce(
    (best, row) => (row.omzet > best.omzet ? row : best),
    tableRows[0] ?? { label: "-", omzet: 0, transactions: 0 },
  );
  const pageCount = Math.max(1, Math.ceil(tableRows.length / REPORT_DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = tableRows.slice(
    (currentPage - 1) * REPORT_DETAIL_PAGE_SIZE,
    currentPage * REPORT_DETAIL_PAGE_SIZE,
  );

  if (!hasTrend) {
    return <EmptyState label="Data trend penjualan belum tersedia." />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
        {selectedMonth
          ? `Detail harian: ${selectedMonth.label}`
          : `Periode aktif: ${periodLabel}`}
      </div>
      <div className="rounded-2xl border border-slate-100 p-4">
        <TrendChart rows={chartRows} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Total Omzet" value={rupiahCompact(totalOmzet)} />
        <InsightBox
          label={selectedMonth ? "Rata-rata / hari" : "Rata-rata / bulan"}
          value={rupiahCompact(averageValue)}
        />
        <InsightBox
          label={selectedMonth ? "Hari terbaik" : "Bulan terbaik"}
          value={bestRow.label}
        />
        <InsightBox label="Total transaksi" value={String(totalTransactions)} />
      </div>
      {selectedMonth ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan breakdown harian untuk{" "}
            <strong className="text-slate-900">{selectedMonth.label}</strong>.
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedMonthKey(null);
              setSelectedDayLabel(null);
              setPage(1);
            }}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
          >
            Kembali ke bulanan
          </button>
        </div>
      ) : null}
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[620px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[180px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            {!selectedMonth ? <col className="w-[140px]" /> : null}
            <col className="w-[120px]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="px-4 py-3">{selectedMonth ? "Tanggal" : "Bulan"}</th>
              <th className="px-4 py-3 text-right">Omzet</th>
              <th className="px-4 py-3 text-right">Jumlah transaksi</th>
              <th className="px-4 py-3 text-right">
                {selectedMonth ? "ATV" : "Rata-rata harian"}
              </th>
              {!selectedMonth ? <th className="px-4 py-3 text-right">ATV</th> : null}
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, index) => (
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
                    ? selectedMonth
                      ? rupiahCompact(Math.round(row.omzet / row.transactions))
                      : rupiahCompact(
                          Math.round(
                            row.omzet / Math.max((row as MonthlyTrendRow).days, 1),
                          ),
                        )
                    : "-"}
                </td>
                {!selectedMonth ? (
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-700">
                    {row.transactions > 0
                      ? rupiahCompact(Math.round(row.omzet / row.transactions))
                      : "-"}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMonth) {
                        setSelectedDayLabel(row.label);
                        return;
                      }

                      setSelectedMonthKey((row as MonthlyTrendRow).key);
                      setSelectedDayLabel(null);
                      setPage(1);
                    }}
                    className="inline-flex min-h-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-extrabold text-blue-700 transition hover:bg-blue-100"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ClientPaginationControl
          currentPage={currentPage}
          totalItems={tableRows.length}
          pageSize={REPORT_DETAIL_PAGE_SIZE}
          onPageChange={setPage}
          className="rounded-b-xl"
        />
      </div>
      {selectedDay ? (
        <DailyTrendActivityDetail
          day={selectedDay}
          transactions={dayTransactions}
          returnRecords={dayReturnRecords}
        />
      ) : null}
    </div>
  );
}

function DailyTrendActivityDetail({
  day,
  transactions,
  returnRecords,
}: {
  day: TrendRow;
  transactions: TransactionRow[];
  returnRecords: ReturnRecord[];
}) {
  const atv = day.transactions > 0 ? Math.round(day.omzet / day.transactions) : 0;
  const returnCount = transactions.reduce(
    (total, transaction) => total + transaction.returnCount,
    0,
  );
  const pendingOrCancelledTransactions = transactions.filter(
    (transaction) =>
      ["PENDING", "CANCELLED", "FAILED"].includes(transaction.transactionStatus) ||
      ["WAITING_PROOF", "FAILED", "UNPAID"].includes(transaction.paymentStatus),
  );
  const paymentRows = Array.from(
    transactions
      .reduce((map, transaction) => {
        const key = transaction.paymentLabel || transaction.paymentMethod || "Lainnya";
        const current = map.get(key) ?? { label: key, total: 0, transactions: 0 };

        current.total += transaction.subtotal;
        current.transactions += 1;
        map.set(key, current);

        return map;
      }, new Map<string, { label: string; total: number; transactions: number }>())
      .values(),
  ).sort((a, b) => b.total - a.total);

  return (
    <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">
            Aktivitas harian
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-950">{day.label}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Detail ini memakai data transaksi yang sudah tersedia di laporan saat ini.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Omzet hari itu" value={rupiahCompact(day.omzet)} />
        <InsightBox label="Jumlah transaksi" value={String(day.transactions)} />
        <InsightBox label="ATV" value={day.transactions > 0 ? rupiahCompact(atv) : "-"} />
        <InsightBox
          label="Retur"
          value={
            returnCount > 0 || returnRecords.length > 0
              ? `${Math.max(returnCount, returnRecords.length)} catatan`
              : "-"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-slate-900">Payment method</p>
          <div className="mt-3 space-y-2">
            {paymentRows.length > 0 ? (
              paymentRows.map((payment) => (
                <div
                  key={payment.label}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{payment.label}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {payment.transactions} transaksi
                    </p>
                  </div>
                  <strong className="shrink-0 tabular-nums text-slate-950">
                    {rupiahCompact(payment.total)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                Belum ada payment method pada transaksi yang tersedia.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-slate-900">Pending / cancelled</p>
          <div className="mt-3 space-y-2">
            {pendingOrCancelledTransactions.length > 0 ? (
              pendingOrCancelledTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <p className="font-bold text-slate-900">{transaction.invoiceNumber}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-extrabold", statusBadgeClass(transaction.transactionStatus))}>
                      {transaction.transactionStatus}
                    </span>
                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-extrabold", statusBadgeClass(transaction.paymentStatus))}>
                      {transaction.paymentStatus}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                Tidak ada pending/cancelled pada transaksi yang tersedia. Data penuh pending/cancelled belum dimuat di payload trend laporan.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-slate-900">Retur & produk</p>
          <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
            {returnRecords.length > 0 ? (
              <div className="space-y-2">
                {returnRecords.map((record) => (
                  <div key={record.id} className="rounded-xl bg-white px-3 py-2">
                    <p className="font-bold text-slate-900">{record.number}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.reason} • {record.total}
                    </p>
                  </div>
                ))}
              </div>
            ) : returnCount > 0 ? (
              <p>Ada {returnCount} transaksi dengan retur pada data transaksi hari ini.</p>
            ) : (
              <p>Tidak ada retur pada data yang tersedia.</p>
            )}
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Produk terlaris harian belum tersedia di payload detail trend karena daftar transaksi belum memuat item produk.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            Daftar transaksi hari itu
          </h4>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
            {transactions.length} transaksi
          </span>
        </div>
        {transactions.length > 0 ? (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 font-extrabold text-slate-900">
                      {transaction.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      {transaction.createdAtLabel}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      {transaction.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", paymentBadgeClass(transaction.paymentMethod))}>
                        {transaction.paymentLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", statusBadgeClass(transaction.paymentStatus))}>
                        {transaction.paymentStatus}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
                      {transaction.formattedSubtotal}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/invoices/${transaction.id}`}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-extrabold text-blue-700 transition hover:bg-blue-100"
                      >
                        Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState label="Daftar transaksi hari ini belum tersedia di payload laporan." />
          </div>
        )}
      </div>
    </section>
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
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(transactions.length / REPORT_DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTransactions = transactions.slice(
    (currentPage - 1) * REPORT_DETAIL_PAGE_SIZE,
    currentPage * REPORT_DETAIL_PAGE_SIZE,
  );

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
          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="p-0">
              <RecentTransactions
                rows={visibleTransactions}
                mobile
                limit={REPORT_DETAIL_PAGE_SIZE}
                onSelect={onSelectTransaction}
              />
            </div>
            <ClientPaginationControl
              currentPage={currentPage}
              totalItems={transactions.length}
              pageSize={REPORT_DETAIL_PAGE_SIZE}
              onPageChange={setPage}
              className="rounded-b-2xl"
            />
          </div>
        ) : (
          <EmptyState label="Detail transaksi pembayaran belum tersedia." />
        )}
      </div>
    </div>
  );
}

function PurchaseDetailContent({
  purchases,
  selectedPurchase,
  onSelectPurchase,
}: {
  purchases: PurchaseRow[];
  selectedPurchase: PurchaseRow | null;
  onSelectPurchase: (purchase: PurchaseRow | null) => void;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(purchases.length / REPORT_DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visiblePurchases = purchases.slice(
    (currentPage - 1) * REPORT_DETAIL_PAGE_SIZE,
    currentPage * REPORT_DETAIL_PAGE_SIZE,
  );

  if (!purchases.length) {
    return <EmptyState label="Belum ada pembelian pada periode ini." />;
  }

  return (
    <div className="space-y-5">
      <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 md:block">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[190px]" />
            <col className="w-[130px]" />
            <col className="w-[160px]" />
            <col className="w-[80px]" />
            <col className="w-[95px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[170px]" />
            <col className="w-[100px]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Nomor PO</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Item</th>
              <th className="px-4 py-3 text-right">Total Qty</th>
              <th className="px-4 py-3 text-right">Total Pembelian</th>
              <th className="px-4 py-3">Dibuat oleh</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visiblePurchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-900">
                <td className="px-4 py-3 font-extrabold text-slate-950 dark:text-slate-100">
                  {purchase.number}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                  {purchase.date}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  {purchase.supplier}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                  {purchase.itemCount}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                  {purchase.totalQty}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950 dark:text-slate-100">
                  {purchase.total}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                  {purchase.createdBy ?? "Data tidak tersedia"}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  <span className="line-clamp-2">{purchase.notes ?? "-"}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelectPurchase(purchase)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ClientPaginationControl
          currentPage={currentPage}
          totalItems={purchases.length}
          pageSize={REPORT_DETAIL_PAGE_SIZE}
          itemLabel="data"
          onPageChange={setPage}
          className="rounded-b-2xl"
        />
      </div>

      <div className="mobile-card-list rounded-2xl border border-slate-100 md:hidden dark:border-slate-800">
        {visiblePurchases.map((purchase) => (
          <article key={purchase.id} className="mobile-data-card">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-all text-base font-extrabold text-slate-950 dark:text-slate-100">
                  {purchase.number}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {purchase.supplier}
                </p>
              </div>
              <p className="font-extrabold tabular-nums text-slate-950 dark:text-slate-100">
                {purchase.total}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Tanggal
                </span>
                {purchase.date}
              </p>
              <p>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Item
                </span>
                {purchase.itemCount} item
              </p>
              <p>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Qty
                </span>
                {purchase.totalQty}
              </p>
              <p className="min-w-0">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dibuat oleh
                </span>
                <span className="break-words">
                  {purchase.createdBy ?? "Data tidak tersedia"}
                </span>
              </p>
            </div>
            {purchase.notes ? (
              <p className="mt-3 break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {purchase.notes}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => onSelectPurchase(purchase)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-extrabold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
            >
              Detail
            </button>
          </article>
        ))}
        <ClientPaginationControl
          currentPage={currentPage}
          totalItems={purchases.length}
          pageSize={REPORT_DETAIL_PAGE_SIZE}
          itemLabel="data"
          onPageChange={setPage}
          className="rounded-b-2xl"
        />
      </div>

      {selectedPurchase ? (
        <PurchaseItemsDetail purchase={selectedPurchase} onClose={() => onSelectPurchase(null)} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Pilih tombol Detail pada salah satu PO untuk melihat breakdown produk.
        </div>
      )}
    </div>
  );
}

function PurchaseItemsDetail({
  purchase,
  onClose,
}: {
  purchase: PurchaseRow;
  onClose: () => void;
}) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-slate-950 dark:text-slate-100">
            {purchase.number}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {purchase.supplier} - {purchase.date}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-extrabold text-slate-500 dark:text-slate-400"
        >
          Tutup detail
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Total item" value={String(purchase.itemCount)} />
        <InsightBox label="Total qty" value={String(purchase.totalQty)} />
        <InsightBox label="Total pembelian" value={purchase.total} />
        <InsightBox label="Dibuat oleh" value={purchase.createdBy ?? "Data tidak tersedia"} />
      </div>

      {purchase.notes ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          {purchase.notes}
        </div>
      ) : null}

      {purchase.items.length ? (
        <>
        <div className="mt-4 hidden max-w-full overflow-x-auto rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 md:block">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Kategori/Laci</th>
                <th className="px-4 py-3 text-right">Qty Masuk</th>
                <th className="px-4 py-3 text-right">Harga Beli / HPP</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Stok Sebelum</th>
                <th className="px-4 py-3 text-right">Stok Sesudah</th>
                <th className="px-4 py-3">Catatan Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-extrabold text-slate-950 dark:text-slate-100">
                    {item.product}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                    {item.sku}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {item.category ?? "Data tidak tersedia"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    {item.qty}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">
                    {item.costPrice}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950 dark:text-slate-100">
                    {item.subtotal}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {item.stockBefore ?? "Data tidak tersedia"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {item.stockAfter ?? "Data tidak tersedia"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {item.notes ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 mobile-card-list rounded-xl border border-slate-100 md:hidden dark:border-slate-800">
          {purchase.items.map((item) => (
            <article key={item.id} className="mobile-data-card">
              <p className="break-words font-extrabold text-slate-950 dark:text-slate-100">
                {item.product}
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-600 dark:text-slate-300">
                {item.sku}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Kategori/Laci
                  </span>
                  <span className="break-words">
                    {item.category ?? "Data tidak tersedia"}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Qty Masuk
                  </span>
                  <span className="font-bold tabular-nums">{item.qty}</span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Harga Beli / HPP
                  </span>
                  <span className="font-bold tabular-nums">{item.costPrice}</span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Subtotal
                  </span>
                  <span className="font-extrabold tabular-nums text-slate-950 dark:text-slate-100">
                    {item.subtotal}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Stok Sebelum
                  </span>
                  {item.stockBefore ?? "Data tidak tersedia"}
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Stok Sesudah
                  </span>
                  {item.stockAfter ?? "Data tidak tersedia"}
                </p>
              </div>
              <p className="mt-3 break-words text-sm text-slate-500 dark:text-slate-400">
                {item.notes ?? "-"}
              </p>
            </article>
          ))}
        </div>
        </>
      ) : (
        <EmptyState label="Detail produk pembelian tidak tersedia." />
      )}
    </section>
  );
}

function profitStatusClass(status: ProfitProductRow["status"]) {
  if (status === "Sehat") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status === "Margin rendah") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  if (status === "Rugi") return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

type ProfitStatusFilter = (typeof PROFIT_STATUS_FILTERS)[number];

type ProfitDetailResponse = {
  period: {
    from: string;
    to: string;
    label: string;
  };
  profitSummary: OwnerReportViewData["profitSummary"];
};

async function fetchProfitDetail(from: string, to: string) {
  const token =
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(TOKEN_KEY) ?? "";
  const response = await fetch(
    `/api/reports/laba-margin?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "Gagal memuat detail laba & margin.",
    );
  }

  return (await response.json()) as ProfitDetailResponse;
}

function ProfitDetailContent({
  initialSummary,
  initialPeriod,
}: {
  initialSummary: OwnerReportViewData["profitSummary"];
  initialPeriod: OwnerReportViewData["period"];
}) {
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(initialSummary);
  const [period, setPeriod] = useState({
    from: initialPeriod.from,
    to: initialPeriod.to,
    label: initialPeriod.label,
  });
  const [draftFrom, setDraftFrom] = useState(formatDateID(initialPeriod.from));
  const [draftTo, setDraftTo] = useState(formatDateID(initialPeriod.to));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProfitStatusFilter>("Semua");
  const [selectedProduct, setSelectedProduct] = useState<ProfitProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const rows = useMemo(() => {
    return summary.products.filter((item) => {
      const keyword = debouncedSearch;
      const matchesSearch =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword) ||
        (item.category?.toLowerCase().includes(keyword) ?? false);
      const matchesStatus =
        statusFilter === "Semua" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, statusFilter, summary.products]);

  const pageCount = Math.max(1, Math.ceil(rows.length / REPORT_DETAIL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice(
    (currentPage - 1) * REPORT_DETAIL_PAGE_SIZE,
    currentPage * REPORT_DETAIL_PAGE_SIZE,
  );

  async function handleApplyPeriod() {
    const parsedFrom = parseIDDateInput(draftFrom);
    const parsedTo = parseIDDateInput(draftTo);

    if (!parsedFrom || !parsedTo) {
      setError("Periode wajib memakai format dd/mm/yyyy, contoh 15/05/2026.");
      return;
    }

    if (compareIsoDate(parsedFrom, parsedTo) > 0) {
      setError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedProduct(null);

    try {
      const payload = await fetchProfitDetail(parsedFrom, parsedTo);
      setSummary(payload.profitSummary);
      setPeriod(payload.period);
      setDraftFrom(formatDateID(payload.period.from));
      setDraftTo(formatDateID(payload.period.to));
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail laba & margin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    setError(null);

    try {
      const from = encodeURIComponent(period.from);
      const to = encodeURIComponent(period.to);
      const fallback =
        period.from === period.to
          ? `laba-margin-${period.from}.pdf`
          : `laba-margin-${period.from}-to-${period.to}.pdf`;

      await downloadOwnerReportPdf(
        `/api/reports/export/laba-margin/pdf?from=${from}&to=${to}`,
        fallback,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PDF laba & margin gagal.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Periode dari
            <input
              type="text"
              inputMode="numeric"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              onBlur={() => {
                const parsed = parseIDDateInput(draftFrom);
                if (parsed) setDraftFrom(formatDateID(parsed));
              }}
              placeholder="dd/mm/yyyy"
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Periode sampai
            <input
              type="text"
              inputMode="numeric"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              onBlur={() => {
                const parsed = parseIDDateInput(draftTo);
                if (parsed) setDraftTo(formatDateID(parsed));
              }}
              placeholder="dd/mm/yyyy"
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="min-w-0 flex-[1.4] text-sm font-semibold text-slate-700 dark:text-slate-200">
            Cari
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
              value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari produk, SKU, kategori..."
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </label>
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ProfitStatusFilter);
                setPage(1);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {PROFIT_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:pb-0.5">
            <button
              type="button"
              onClick={handleApplyPeriod}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? "Memuat..." : "Terapkan"}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Export PDF Laba & Margin"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Export..." : "Export PDF"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          Periode detail: {period.label}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Omzet Kotor" value={summary.grossRevenue} />
        <InsightBox label="Retur Customer" value={summary.returnRevenue} />
        <InsightBox label="Omzet Bersih" value={summary.netRevenue} />
        <InsightBox label="HPP Penjualan" value={summary.salesCogs} />
        <InsightBox label="HPP Retur" value={summary.returnCogs} />
        <InsightBox label="HPP Bersih" value={summary.netCogs} />
        <InsightBox label="Laba Kotor" value={summary.grossProfit} />
        <InsightBox label="Margin %" value={summary.margin} />
      </div>

      {summary.returnCostWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {summary.returnCostWarning}
        </div>
      ) : null}

      {!summary.hasUnitCostSnapshot ? (
        <EmptyState label="Data snapshot HPP belum tersedia. Laba dan margin akan muncul untuk transaksi baru setelah checkout menyimpan HPP." />
      ) : rows.length ? (
        <>
        <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 md:block">
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[240px]" />
              <col className="w-[110px]" />
              <col className="w-[90px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-100 px-3 py-3 dark:bg-slate-900">Produk</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3 text-right">Qty Net</th>
                <th className="px-3 py-3 text-right">Omzet Bersih</th>
                <th className="px-3 py-3 text-right">HPP Bersih</th>
                <th className="px-3 py-3 text-right">Laba Kotor</th>
                <th className="px-3 py-3 text-right">Margin</th>
                <th className="px-3 py-3">Status</th>
                <th className="sticky right-0 z-10 bg-slate-100 px-3 py-3 text-right dark:bg-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.map((item) => (
                <tr
                  key={item.productId}
                  className={cx(
                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                    selectedProduct?.productId === item.productId
                      ? "bg-teal-50/70 dark:bg-teal-500/10"
                      : "bg-white dark:bg-slate-950",
                  )}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-3">
                    <p className="break-words font-extrabold text-slate-950 dark:text-slate-100">
                      {item.name}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.category ?? "Data tidak tersedia"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.sku}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">{item.netQty}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{item.netRevenue}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{item.netCogs}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{item.profit}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    {item.marginValid ? item.margin : "Tidak valid"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cx("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold", profitStatusClass(item.status))}>
                      {item.status}
                    </span>
                  </td>
                  <td className="sticky right-0 z-10 bg-inherit px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(item)}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-800"
                    >
                      {selectedProduct?.productId === item.productId ? "Terbuka" : "Detail Produk"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ClientPaginationControl
            currentPage={currentPage}
            totalItems={rows.length}
            pageSize={REPORT_DETAIL_PAGE_SIZE}
            itemLabel="data"
            onPageChange={setPage}
            className="rounded-b-2xl"
          />
        </div>
        <div className="mobile-card-list rounded-2xl border border-slate-200 md:hidden dark:border-slate-800">
          {visibleRows.map((item) => (
            <article
              key={item.productId}
              className={cx(
                "mobile-data-card",
                selectedProduct?.productId === item.productId &&
                  "bg-teal-50/70 dark:bg-teal-500/10",
              )}
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-extrabold text-slate-950 dark:text-slate-100">
                    {item.name}
                  </p>
                  <p className="mt-1 break-words text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {item.sku} - {item.category ?? "Data tidak tersedia"}
                  </p>
                </div>
                <span className={cx("w-fit rounded-full px-2.5 py-1 text-xs font-extrabold", profitStatusClass(item.status))}>
                  {item.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Qty Net
                  </span>
                  <span className="font-bold tabular-nums">{item.netQty}</span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Margin
                  </span>
                  <span className="font-bold tabular-nums">
                    {item.marginValid ? item.margin : "Tidak valid"}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Omzet Bersih
                  </span>
                  <span className="font-bold tabular-nums text-slate-950 dark:text-slate-100">
                    {item.netRevenue}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    HPP Bersih
                  </span>
                  <span className="font-bold tabular-nums text-slate-950 dark:text-slate-100">
                    {item.netCogs}
                  </span>
                </p>
                <p className="col-span-2">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Laba Kotor
                  </span>
                  <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {item.profit}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(item)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                {selectedProduct?.productId === item.productId ? "Terbuka" : "Detail Produk"}
              </button>
            </article>
          ))}
          <ClientPaginationControl
            currentPage={currentPage}
            totalItems={rows.length}
            pageSize={REPORT_DETAIL_PAGE_SIZE}
            itemLabel="data"
            onPageChange={setPage}
            className="rounded-b-2xl"
          />
        </div>
        </>
      ) : (
        <EmptyState label={summary.products.length ? "Tidak ada produk yang cocok." : "Tidak ada data laba & margin untuk periode ini."} />
      )}

      {selectedProduct ? (
        <ReportModal
          title="Detail Produk Margin"
          subtitle={`Periode detail: ${period.label}`}
          onClose={() => setSelectedProduct(null)}
          panelClassName="max-w-6xl"
        >
          <ProfitProductAuditContent product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        </ReportModal>
      ) : null}
    </div>
  );
}

function ProfitProductAuditContent({
  product,
  onClose,
}: {
  product: ProfitProductRow;
  onClose: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-slate-950 dark:text-slate-100">
            {product.name}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {product.sku} - {product.category ?? "Data tidak tersedia"}
          </p>
          <span className={cx("mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", profitStatusClass(product.status))}>
            {product.status}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-extrabold text-slate-500 dark:text-slate-400"
        >
          Tutup detail
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightBox label="Qty terjual" value={String(product.soldQty)} />
        <InsightBox label="Qty retur" value={String(product.returnQty)} />
        <InsightBox label="Qty net" value={String(product.netQty)} />
        <InsightBox label="Omzet kotor" value={product.grossRevenue} />
        <InsightBox label="Retur customer" value={product.returnRevenue} />
        <InsightBox label="Omzet bersih" value={product.netRevenue} />
        <InsightBox label="HPP penjualan" value={product.salesCogs} />
        <InsightBox label="HPP retur" value={product.returnCogs} />
        <InsightBox label="HPP bersih" value={product.netCogs} />
        <InsightBox label="Laba" value={product.profit} />
        <InsightBox label="Margin" value={product.marginValid ? product.margin : "Tidak valid"} />
        <InsightBox label="Status" value={product.status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <h4 className="text-sm font-extrabold text-slate-950 dark:text-slate-100">Transaksi Penjualan</h4>
          {product.sales.length ? (
            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Omzet</th>
                    <th className="px-3 py-2 text-right">HPP</th>
                    <th className="px-3 py-2 text-right">Laba</th>
                    <th className="px-3 py-2 text-right">Margin</th>
                    <th className="px-3 py-2">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {product.sales.map((sale, index) => (
                    <tr key={`${sale.invoiceNumber}-${index}`}>
                      <td className="px-3 py-2 font-bold text-slate-950 dark:text-slate-100">{sale.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{sale.createdAt}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">{sale.qty}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{sale.revenue}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-950 dark:text-slate-100">{sale.cogs}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{sale.profit}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">{sale.margin}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{sale.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="Belum ada transaksi penjualan untuk produk ini pada periode ini." />
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <h4 className="text-sm font-extrabold text-slate-950 dark:text-slate-100">Retur Produk</h4>
          {product.returns.length ? (
            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Retur</th>
                    <th className="px-3 py-2 text-right">HPP Retur</th>
                    <th className="px-3 py-2">Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {product.returns.map((saleReturn, index) => (
                    <tr key={`${saleReturn.invoiceNumber}-${index}`}>
                      <td className="px-3 py-2 font-bold text-slate-950 dark:text-slate-100">{saleReturn.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{saleReturn.createdAt}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">{saleReturn.qty}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700 dark:text-rose-300">{saleReturn.revenue}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700 dark:text-rose-300">{saleReturn.cogs}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{saleReturn.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="Belum ada retur produk pada periode ini." />
          )}
        </div>
      </div>
    </section>
  );
}

function InsightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}
