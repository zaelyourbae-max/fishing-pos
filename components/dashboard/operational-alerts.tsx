"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Info,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";

type AlertSeverity = "critical" | "warning" | "info";

export type OperationalAlert = {
  id: string;
  title: string;
  helper: string;
  detail: string;
  severity: AlertSeverity;
  href: string;
  action: string;
};

type OperationalAlertsProps = {
  alerts: OperationalAlert[];
  maxItems?: number;
};

const severityStyle: Record<
  AlertSeverity,
  {
    card: string;
    icon: string;
    text: string;
  }
> = {
  critical: {
    card: "border-rose-100 bg-rose-50/80 hover:bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10",
    icon: "bg-white text-rose-600 dark:bg-rose-500/15 dark:text-rose-200",
    text: "text-rose-700 dark:text-rose-200",
  },
  warning: {
    card: "border-amber-100 bg-amber-50/80 hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10",
    icon: "bg-white text-amber-600 dark:bg-amber-500/15 dark:text-amber-200",
    text: "text-amber-700 dark:text-amber-200",
  },
  info: {
    card: "border-blue-100 bg-blue-50/80 hover:bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10",
    icon: "bg-white text-blue-600 dark:bg-blue-500/15 dark:text-blue-200",
    text: "text-blue-700 dark:text-blue-200",
  },
};

function iconFor(alert: OperationalAlert) {
  if (alert.id.includes("stock")) {
    return Package;
  }

  if (alert.id.includes("supplier")) {
    return Truck;
  }

  if (alert.id.includes("return")) {
    return RotateCcw;
  }

  if (alert.severity === "critical") {
    return CircleAlert;
  }

  if (alert.severity === "warning") {
    return AlertTriangle;
  }

  return Info;
}

export default function OperationalAlerts({
  alerts,
  maxItems = alerts.length,
}: OperationalAlertsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const visibleLimit = Math.max(0, maxItems);
  const hasHiddenAlerts = alerts.length > visibleLimit;
  const visibleAlerts =
    showAll || !hasHiddenAlerts ? alerts : alerts.slice(0, visibleLimit);

  return (
    <section className="flex h-full min-w-0 flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
        className="flex w-full items-start justify-between gap-3 text-left transition duration-200 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:focus:ring-teal-500/10"
        title={collapsed ? "Buka Alert Operasional" : "Lipat Alert Operasional"}
      >
        <h2 className="min-w-0 flex-1 break-words text-lg font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white">
          Alert Operasional
        </h2>
        <span className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {alerts.length} alert
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </span>
      </button>

      <div
        className={`mt-4 flex-1 space-y-3 ${collapsed ? "hidden" : ""}`}
      >
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <Info className="mx-auto h-8 w-8 text-teal-600 dark:text-teal-200" />
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              Belum ada alert operasional.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Kondisi penting toko akan muncul di sini.
            </p>
          </div>
        ) : null}

        {visibleAlerts.map((alert) => {
          const Icon = iconFor(alert);
          const style = severityStyle[alert.severity];
          const expanded = expandedId === alert.id;

          return (
            <div
              key={alert.id}
              className={`rounded-2xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-950/70 ${style.card} ${
                expanded ? "shadow-sm ring-1 ring-white/70" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : alert.id)}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-start justify-between gap-3 p-3 text-left transition duration-200 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:focus:ring-teal-500/10"
                title={`Buka detail ${alert.title}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block line-clamp-2 text-sm font-bold leading-snug ${style.text}`}>
                      {alert.title}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
                      {alert.helper}
                    </span>
                    {!expanded ? (
                      <span className="mt-2 inline-flex whitespace-nowrap text-xs font-bold text-blue-700 dark:text-blue-200">
                        Lihat detail
                      </span>
                    ) : null}
                  </span>
                </span>
                <ArrowRight
                  className={`h-4 w-4 shrink-0 text-slate-500 transition ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
              </button>

              {expanded ? (
                <div className="border-t border-white/70 px-3 pb-3 pt-2 dark:border-slate-800/80">
                  <Link
                    href={alert.href}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:text-teal-700 active:scale-95 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-teal-200"
                  >
                    {alert.action}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasHiddenAlerts && !collapsed ? (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-teal-700 transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-950 dark:text-teal-200 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10"
          >
            {showAll ? "Ringkas" : "Lihat semua"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
