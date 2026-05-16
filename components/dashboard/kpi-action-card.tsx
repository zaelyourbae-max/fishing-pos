"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  LineChart,
  Package,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Wallet,
  X,
} from "lucide-react";

export type KpiIconName =
  | "alert"
  | "clipboard"
  | "line-chart"
  | "package"
  | "rotate"
  | "shopping-bag"
  | "shopping-cart"
  | "truck"
  | "wallet";

export type KpiDetail = {
  title: string;
  description: string;
  emptyLabel?: string;
  rows: {
    label: string;
    value: string;
    meta?: string;
    tone?: "default" | "good" | "danger";
  }[];
};

type KpiActionCardProps = {
  title: string;
  value: string;
  helper: string;
  trend?: {
    text: string;
    positive: boolean;
  };
  icon: KpiIconName;
  tone: "emerald" | "blue" | "violet" | "amber" | "rose";
  detail: KpiDetail;
};

const toneClass = {
  emerald: "bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

const icons = {
  alert: AlertTriangle,
  clipboard: ClipboardList,
  "line-chart": LineChart,
  package: Package,
  rotate: RotateCcw,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  truck: Truck,
  wallet: Wallet,
};

function rowValueClass(tone: KpiDetail["rows"][number]["tone"]) {
  if (tone === "good") {
    return "text-teal-700 dark:text-teal-200";
  }

  if (tone === "danger") {
    return "text-rose-600 dark:text-rose-300";
  }

  return "text-slate-950 dark:text-white";
}

export default function KpiActionCard({
  title,
  value,
  helper,
  trend,
  icon,
  tone,
  detail,
}: KpiActionCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = icons[icon];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={open}
        title={`Lihat detail ${title}`}
        className={`group flex h-full min-h-28 cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-100 dark:bg-slate-950/70 dark:focus:ring-blue-500/10 ${
          open
            ? "border-blue-300 ring-4 ring-blue-100 dark:border-blue-500/60 dark:ring-blue-500/10"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneClass[tone]}`}
        >
          <Icon className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
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
                {trend.positive ? "+" : "-"} {trend.text}
              </span>
            ) : null}
            {helper}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  {detail.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {detail.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                aria-label="Tutup detail KPI"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {detail.rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {detail.emptyLabel ?? "Belum ada data."}
                </div>
              ) : null}
              {detail.rows.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                        {row.label}
                      </p>
                      {row.meta ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {row.meta}
                        </p>
                      ) : null}
                    </div>
                    <p
                      className={`shrink-0 text-right text-sm font-bold tabular-nums ${rowValueClass(
                        row.tone,
                      )}`}
                    >
                      {row.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
