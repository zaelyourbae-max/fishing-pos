"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, FileText, Wallet, X } from "lucide-react";

import MobileFoldList from "@/components/ui/mobile-fold-list";

type SaleRow = {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  createdAt: string;
  cashierName: string;
  cashierRoleName?: string | null;
  cashierRoleSlug?: string | null;
  customerName: string;
  itemCount: number;
  returnCount: number;
  paymentMethod: string;
  transactionStatus: string;
  paymentStatus: string;
  items: {
    name: string;
    sku: string;
    qty: number;
  }[];
};

type PaymentRow = {
  method: string;
  total: string;
  count: number;
  percent: string;
  color: string;
  href: string;
};

type TransactionPaymentPanelProps = {
  recentSales: SaleRow[];
  paymentSummary: PaymentRow[];
  paymentTotal: string;
  paymentGradient: string;
  expectedCash: string;
};

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
    <div className="flex items-center justify-between gap-4">
      <h2 className="min-w-0 truncate text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 transition hover:bg-teal-50 hover:text-teal-600 active:scale-95 dark:text-teal-300 dark:hover:bg-teal-500/10"
        title={action}
      >
        {action}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyState({
  label,
  helper,
  icon,
}: {
  label: string;
  helper?: string;
  icon: "file" | "wallet";
}) {
  const Icon = icon === "file" ? FileText : Wallet;

  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
        <Icon className="h-8 w-8" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function paymentTone(method: string) {
  const normalized = method.toUpperCase();

  if (normalized.includes("QRIS")) {
    return "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
  }

  if (normalized.includes("TRANSFER")) {
    return "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200";
  }

  if (normalized.includes("CASH")) {
    return "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200";
  }

  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

const TONE_OK =
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
const TONE_WAIT =
  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
const TONE_BAD =
  "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";

/** Istilah metode bayar dari database -> bahasa owner. */
function paymentLabel(method: string) {
  const m = method.toUpperCase();

  if (m.includes("QRIS")) return "QRIS";
  if (m.includes("TRANSFER") || m.includes("BANK")) return "Transfer";

  // Hanya ada 3 metode resmi (CASH/QRIS/TRANSFER) & kolom default-nya "CASH",
  // jadi sisanya selalu dianggap Tunai — tidak pernah tampil kode mentah.
  return "Tunai";
}

/**
 * Gabungkan status transaksi + status bayar jadi SATU status ringkas yang
 * mudah dipahami owner (mis. "Lunas"), bukan 2-3 label Inggris mentah.
 */
function saleStateBadge(transactionStatus: string, paymentStatus: string) {
  if (transactionStatus === "CANCELLED") return { label: "Dibatalkan", tone: TONE_BAD };
  if (paymentStatus === "FAILED") return { label: "Gagal", tone: TONE_BAD };
  if (paymentStatus === "PAID" && transactionStatus === "SUCCESS")
    return { label: "Lunas", tone: TONE_OK };
  if (paymentStatus === "WAITING_PROOF") return { label: "Menunggu bukti", tone: TONE_WAIT };
  if (paymentStatus === "UNPAID") return { label: "Belum dibayar", tone: TONE_WAIT };

  return { label: "Diproses", tone: TONE_WAIT };
}

export default function TransactionPaymentPanel({
  recentSales,
  paymentSummary,
  paymentTotal,
  paymentGradient,
  expectedCash,
}: TransactionPaymentPanelProps) {
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  // Khusus mobile: rincian + Perkiraan Uang di Laci bisa dilipat (donat tetap tampil).
  // Di desktop (lg+) semua selalu terbuka — lihat kelas lg: di bawah.
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const filteredSales = useMemo(() => {
    if (!selectedPayment) {
      return recentSales;
    }

    return recentSales.filter((sale) => sale.paymentMethod === selectedPayment);
  }, [recentSales, selectedPayment]);

  return (
    <>
      <section className="order-2 min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5 xl:order-1">
        <SectionHeader title="Transaksi Terakhir" href="/sales" />
        {selectedPayment ? (
          <button
            type="button"
            onClick={() => setSelectedPayment(null)}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 transition hover:bg-teal-100 active:scale-95 dark:bg-teal-500/10 dark:text-teal-200"
            title="Hapus filter pembayaran"
          >
            Filter aktif: {selectedPayment}
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div className="mt-4 space-y-3">
          {filteredSales.length === 0 ? (
            <EmptyState
              icon="file"
              label={
                selectedPayment
                  ? "Tidak ada transaksi pada filter ini."
                  : "Belum ada transaksi."
              }
              helper="Transaksi POS akan muncul di sini."
            />
          ) : null}
          <MobileFoldList visible={3}>
          {filteredSales.map((sale) => {
            const state = saleStateBadge(
              sale.transactionStatus,
              sale.paymentStatus,
            );

            return (
              <button
                key={sale.id}
                type="button"
                onClick={() => setSelectedSale(sale)}
                className="flex w-full min-w-0 cursor-pointer items-end justify-between gap-3 rounded-2xl border border-slate-100 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10 sm:gap-4"
                title={`Lihat detail ${sale.invoiceNumber}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      sale.returnCount > 0
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Utama: nomor invoice. */}
                    <span className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">
                      {sale.invoiceNumber}
                    </span>
                    {/* Status ringkas: metode bayar + satu status. */}
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentTone(
                          sale.paymentMethod,
                        )}`}
                      >
                        {paymentLabel(sale.paymentMethod)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${state.tone}`}
                      >
                        {state.label}
                      </span>
                      {sale.returnCount > 0 ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
                          Ada retur
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {sale.cashierName}
                    </span>
                  </span>
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap text-right text-sm font-extrabold tabular-nums ${
                    sale.returnCount > 0
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-slate-950 dark:text-white"
                  }`}
                >
                  {sale.returnCount > 0 ? "-" : ""}
                  {sale.subtotal}
                </span>
              </button>
            );
          })}
          </MobileFoldList>
        </div>
      </section>

      <section className="order-1 min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5 xl:order-2">
        <SectionHeader title="Pembayaran Hari Ini" href="/reports" action="Lihat detail" />
        <div className="mt-5 flex min-w-0 flex-col items-center gap-5">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full sm:h-40 sm:w-40 lg:h-56 lg:w-56">
            <div
              className="absolute inset-0 rounded-full transition duration-300"
              style={{ background: `conic-gradient(${paymentGradient})` }}
            />
            <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-sm ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800 lg:h-36 lg:w-36">
              <span className="text-sm font-extrabold text-slate-950 dark:text-white sm:text-base lg:text-xl">
                {paymentTotal}
              </span>
              <span className="mt-1 text-xs text-slate-500">Total Omzet</span>
            </div>
          </div>
          <div
            className={`w-full min-w-0 space-y-3 lg:block ${
              showPaymentDetail ? "block" : "hidden"
            }`}
          >
            {paymentSummary.length === 0 ? (
              <EmptyState icon="wallet" label="Belum ada pembayaran hari ini." />
            ) : null}
            {paymentSummary.map((item) => {
              const isSelected = selectedPayment === item.method;

              return (
                <button
                  key={item.method}
                  type="button"
                  onClick={() => setSelectedPayment(isSelected ? null : item.method)}
                  aria-pressed={isSelected}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border px-3 py-2.5 text-left text-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
                    isSelected
                      ? "border-teal-300 bg-teal-50/70 dark:border-teal-500/60 dark:bg-teal-500/10"
                      : "border-slate-100 dark:border-slate-800"
                  }`}
                  title={`Filter transaksi ${item.method}`}
                >
                  <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">
                      {item.method} ({item.count})
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {item.total}
                  </span>
                  <span className="col-span-2 text-xs font-semibold text-slate-500 sm:col-span-1 sm:text-right">
                    {item.percent}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={`mt-4 min-h-12 items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm dark:border-teal-500/30 dark:bg-teal-500/10 lg:flex ${
            showPaymentDetail ? "flex" : "hidden"
          }`}
        >
          <span className="font-bold text-teal-700 dark:text-teal-200">
            Perkiraan Uang di Laci
          </span>
          <span className="text-right text-base font-extrabold tabular-nums text-teal-800 dark:text-teal-100">
            {expectedCash}
          </span>
        </div>
        {/* Tombol lipat — hanya muncul di mobile; desktop (lg+) sudah selalu terbuka. */}
        <button
          type="button"
          onClick={() => setShowPaymentDetail((open) => !open)}
          aria-expanded={showPaymentDetail}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 lg:hidden"
        >
          {showPaymentDetail ? "Sembunyikan rincian" : "Lihat rincian pembayaran"}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              showPaymentDetail ? "rotate-180" : ""
            }`}
          />
        </button>
      </section>

      {selectedSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  Detail Transaksi Cepat
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSale.invoiceNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                aria-label="Tutup detail transaksi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-5">
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {[
                  ["Pelanggan", selectedSale.customerName],
                  ["Operator", selectedSale.cashierName],
                  ["Waktu", selectedSale.createdAt],
                  ["Metode bayar", paymentLabel(selectedSale.paymentMethod)],
                  [
                    "Status",
                    saleStateBadge(
                      selectedSale.transactionStatus,
                      selectedSale.paymentStatus,
                    ).label,
                  ],
                  ["Jumlah item", `${selectedSale.itemCount} item`],
                  ["Total", selectedSale.subtotal],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-right text-sm font-bold text-slate-950 dark:text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              {selectedSale.returnCount > 0 ? (
                <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                  Transaksi ini memiliki {selectedSale.returnCount} retur.
                </div>
              ) : null}
              <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Item transaksi
                </p>
                <div className="mt-3 space-y-2">
                  {selectedSale.items.length === 0 ? (
                    <p className="text-xs text-slate-500">Item tidak tersedia.</p>
                  ) : null}
                  {selectedSale.items.map((item) => (
                    <div
                      key={`${item.sku}-${item.name}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">
                          {item.name}
                        </span>
                        <span className="text-xs text-slate-500">{item.sku}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-950 dark:text-white">
                        x{item.qty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href={`/invoices/${selectedSale.id}`}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-[0.99]"
              >
                Buka Invoice
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
