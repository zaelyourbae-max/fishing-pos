"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, PackageX, X } from "lucide-react";
import { formatDateID } from "@/lib/date-format";

export type DeadStockCardItem = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  lastSoldAt: string | null;
  daysSinceLastSold: number | null;
  reason: "NEVER_SOLD" | "NOT_SOLD_OVER_THRESHOLD";
  detailHref: string;
};

type DeadStockCardProps = {
  items: DeadStockCardItem[];
  total: number;
  thresholdDays: number;
  maxItems?: number;
  allHref?: string;
  dark?: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Belum pernah terjual";
  }

  return formatDateID(value);
}

function reasonLabel(reason: DeadStockCardItem["reason"], thresholdDays: number) {
  if (reason === "NEVER_SOLD") {
    return "Belum pernah terjual";
  }

  return `Tidak terjual >= ${thresholdDays} hari`;
}

export default function DeadStockCard({
  items,
  total,
  thresholdDays,
  maxItems = 5,
  allHref = "/products",
  dark = false,
}: DeadStockCardProps) {
  const [selectedItem, setSelectedItem] = useState<DeadStockCardItem | null>(null);
  const visibleItems = items.slice(0, Math.max(0, maxItems));
  const hasMoreItems = total > visibleItems.length;

  return (
    <>
      <section
        className={
          dark
            ? "surface-panel flex h-full flex-col rounded-3xl p-5 sm:p-6"
            : "flex h-full min-w-0 flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2
              className={
                dark
                  ? "text-2xl font-bold text-white"
                  : "break-words text-lg font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white"
              }
            >
              Dead Stock
            </h2>
            <p
              className={
                dark
                  ? "mt-1 text-sm leading-snug text-slate-400"
                  : "mt-1 text-sm leading-snug text-slate-500 dark:text-slate-400"
              }
            >
              Barang tidak terjual {">="} {thresholdDays} hari
            </p>
          </div>
          <span
            className={
              dark
                ? "shrink-0 whitespace-nowrap rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold tabular-nums text-amber-300"
                : "shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-sm font-bold tabular-nums text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
            }
          >
            {total}
          </span>
        </div>

        <div
          className={
            dark
              ? "mt-4 flex-1 space-y-3"
              : "mt-4 flex-1 space-y-2.5"
          }
        >
          {visibleItems.length === 0 ? (
            <div
              className={
                dark
                  ? "rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400"
                  : "rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400"
              }
            >
              Tidak ada dead stock untuk periode ini.
            </div>
          ) : null}

          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              className={
                dark
                  ? "surface-panel-soft flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-800"
                  : "flex min-h-[76px] w-full items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-sm active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-amber-100 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:focus:ring-amber-500/10"
              }
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={
                    dark
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                  }
                >
                  <PackageX className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      dark
                        ? "block break-words font-semibold leading-snug text-white"
                        : "block break-words text-sm font-bold leading-snug text-slate-950 dark:text-white"
                    }
                  >
                    {item.name}
                  </span>
                  <span
                    className={
                      dark
                        ? "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500"
                        : "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"
                    }
                  >
                    <span className="break-all">{item.sku ?? "-"}</span>
                    <span className="whitespace-nowrap">Stok {item.stock}</span>
                  </span>
                </span>
              </span>
              <span
                className={
                  dark
                    ? "shrink-0 whitespace-nowrap text-right text-xs font-bold text-amber-300"
                    : "shrink-0 whitespace-nowrap text-right text-xs font-bold text-amber-700 dark:text-amber-200"
                }
              >
                {item.daysSinceLastSold === null
                  ? "Belum pernah"
                  : `${item.daysSinceLastSold} hari`}
              </span>
            </button>
          ))}
        </div>

        {hasMoreItems ? (
          <div
            className={
              dark
                ? "mt-4 border-t border-slate-800 pt-3"
                : "mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"
            }
          >
            <Link
              href={allHref}
              className={
                dark
                  ? "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-bold text-amber-200 transition duration-200 hover:bg-slate-800 active:scale-[0.99]"
                  : "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-amber-700 transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950 dark:text-amber-200 dark:hover:bg-amber-500/10"
              }
            >
              Lihat semua
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  Detail Dead Stock
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedItem.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                aria-label="Tutup detail dead stock"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {[
                ["Produk", selectedItem.name],
                ["SKU / Kode", selectedItem.sku ?? "-"],
                ["Stok Saat Ini", String(selectedItem.stock)],
                ["Terakhir Terjual", formatDate(selectedItem.lastSoldAt)],
                [
                  "Hari Tidak Terjual",
                  selectedItem.daysSinceLastSold === null
                    ? "-"
                    : `${selectedItem.daysSinceLastSold} hari`,
                ],
                ["Alasan", reasonLabel(selectedItem.reason, thresholdDays)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
                >
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-right text-sm font-bold text-slate-950 dark:text-white">
                    {value}
                  </span>
                </div>
              ))}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Tutup
                </button>
                <Link
                  href={selectedItem.detailHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-[0.99]"
                >
                  Detail Produk
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
