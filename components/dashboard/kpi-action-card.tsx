"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/modal";
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

export type KpiActionCardProps = {
  title: string;
  value: string;
  helper: string;
  trend?: {
    text: string;
    positive: boolean;
  };
  icon: KpiIconName;
  tone: "emerald" | "blue" | "violet" | "amber" | "rose";
  /** Isi popup detail. Diabaikan bila `href` diisi (kartu langsung navigasi). */
  detail?: KpiDetail;
  /** Bila diisi, klik kartu langsung membuka halaman ini (tanpa popup). */
  href?: string;
  /**
   * Ukuran kartu. `compact` (default) untuk mobile, `regular` untuk desktop
   * mengikuti pola kartu KPI di laporan owner (ikon & angka lebih besar).
   */
  size?: "compact" | "regular";
};

const CARD_BASE_CLASS =
  "group card-elevated relative block w-full cursor-pointer rounded-[22px] border bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_20px_48px_rgba(15,23,42,0.12)] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:focus:ring-teal-500/10";

// Icon backgrounds follow the chosen palette (the `teal-*` scale is remapped per
// palette in globals.css). Only rose stays fixed = warning / low stock / return.
const toneClass = {
  emerald: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  blue: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  violet: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  amber: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
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
  href,
  size = "compact",
}: KpiActionCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = icons[icon];
  const isRegular = size === "regular";
  const paddingClass = isRegular ? "p-4 md:p-5" : "p-3";

  const trendNode = trend ? (
    <span
      className={
        trend.positive
          ? "mr-1 text-teal-600 dark:text-teal-300"
          : "mr-1 text-rose-600 dark:text-rose-300"
      }
    >
      {trend.positive ? "+" : "-"} {trend.text}
    </span>
  ) : null;

  const indicatorNode = href ? (
    <ChevronRight
      className="h-5 w-5 shrink-0 text-slate-400 transition duration-200 group-hover:translate-x-0.5 group-hover:text-teal-600 dark:text-slate-500"
      aria-hidden
    />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-teal-300 bg-teal-50 text-[11px] font-bold leading-none text-teal-600 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-300">
      i
    </span>
  );

  // Layout besar (desktop) mengikuti kartu KPI di laporan owner: ikon besar di
  // kiri, judul/angka/keterangan tersusun di kolom kanan.
  const regularInner = (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-1.5">
          <p className="min-w-0 flex-1 text-sm font-bold leading-tight text-slate-500 dark:text-slate-400">
            {title}
          </p>
          {indicatorNode}
        </div>
        <p className="mt-1.5 break-words text-2xl font-extrabold leading-snug tracking-tight tabular-nums text-slate-950 dark:text-white">
          {value}
        </p>
        <p className="mt-2 break-words text-sm font-semibold leading-snug text-slate-500 dark:text-slate-400">
          {trendNode}
          {helper}
        </p>
      </div>
    </div>
  );

  // Layout kecil (mobile / default).
  const compactInner = (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {indicatorNode}
      </div>
      <span className="mt-2 block break-words text-xl font-extrabold leading-snug tracking-tight text-slate-950 dark:text-white">
        {value}
      </span>
      <span className="mt-1.5 block break-words text-[13px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
        {trendNode}
        {helper}
      </span>
    </>
  );

  const cardInner = isRegular ? regularInner : compactInner;

  // Mode navigasi: klik kartu langsung pindah ke tabel terkait (tanpa popup).
  if (href) {
    return (
      <Link
        href={href}
        title={`Buka ${title}`}
        className={`${CARD_BASE_CLASS} ${paddingClass} border-slate-200 dark:border-slate-800`}
      >
        {cardInner}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={open}
        title={`Lihat detail ${title}`}
        className={`${CARD_BASE_CLASS} ${paddingClass} ${
          open
            ? "border-teal-300 ring-4 ring-teal-100 dark:border-teal-500/60 dark:ring-teal-500/10"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        {cardInner}
      </button>

      {detail ? (
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        panelClassName="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
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
      </Modal>
      ) : null}
    </>
  );
}
