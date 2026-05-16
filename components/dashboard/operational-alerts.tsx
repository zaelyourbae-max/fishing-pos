"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
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

export default function OperationalAlerts({ alerts }: OperationalAlertsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">
          Alert Operasional
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {alerts.length} alert
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center dark:border-slate-800">
            <Info className="mx-auto h-8 w-8 text-teal-600 dark:text-teal-200" />
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              Belum ada alert operasional.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Kondisi penting toko akan muncul di sini.
            </p>
          </div>
        ) : null}

        {alerts.map((alert) => {
          const Icon = iconFor(alert);
          const style = severityStyle[alert.severity];
          const expanded = expandedId === alert.id;

          return (
            <div
              key={alert.id}
              className={`rounded-xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-950/70 ${style.card} ${
                expanded ? "shadow-sm ring-1 ring-white/70" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : alert.id)}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition active:scale-[0.99]"
                title={`Buka detail ${alert.title}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-bold ${style.text}`}>
                      {alert.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                      {alert.helper}
                    </span>
                    {!expanded ? (
                      <span className="mt-2 inline-flex text-xs font-bold text-blue-700 dark:text-blue-200">
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
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {alert.detail}
                  </p>
                  <Link
                    href={alert.href}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-teal-700 active:scale-95 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-teal-200"
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
    </section>
  );
}
