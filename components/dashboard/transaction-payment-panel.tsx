"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, FileText, Wallet, X } from "lucide-react";
import {
  operatorLabel,
  transactionIdentityLabel,
} from "@/lib/transaction-identity";

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
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200">
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
    return "bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200";
  }

  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function statusTone(status: string) {
  if (status === "SUCCESS" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (status === "PENDING" || status === "WAITING_PROOF") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }

  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
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
          {filteredSales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => setSelectedSale(sale)}
              className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10 sm:gap-4"
              title={`Lihat quick detail ${sale.invoiceNumber}`}
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
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="max-w-full truncate text-sm font-extrabold text-slate-950 dark:text-white">
                      {sale.invoiceNumber}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentTone(
                        sale.paymentMethod,
                      )}`}
                    >
                      {sale.paymentMethod}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(sale.transactionStatus)}`}>
                      {sale.transactionStatus}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(sale.paymentStatus)}`}>
                      {sale.paymentStatus}
                    </span>
                    {sale.returnCount > 0 ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
                        Ada retur
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {transactionIdentityLabel({
                      operator: {
                        name: sale.cashierName,
                        role: {
                          name: sale.cashierRoleName,
                          slug: sale.cashierRoleSlug,
                        },
                      },
                      customer: { name: sale.customerName },
                    })}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {sale.createdAt} - {sale.itemCount} item
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
          ))}
        </div>
      </section>

      <section className="order-1 min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5 xl:order-2">
        <SectionHeader title="Ringkasan Pembayaran Hari Ini" href="/reports" action="Lihat detail" />
        <div className="mt-5 grid min-w-0 items-center gap-5 lg:grid-cols-[minmax(140px,176px)_1fr]">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full sm:h-40 sm:w-40">
            <div
              className="absolute inset-0 rounded-full transition duration-300"
              style={{ background: `conic-gradient(${paymentGradient})` }}
            />
            <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-sm ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800">
              <span className="text-sm font-extrabold text-slate-950 dark:text-white sm:text-base">
                {paymentTotal}
              </span>
              <span className="mt-1 text-xs text-slate-500">Total Omzet</span>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            {paymentSummary.length === 0 ? (
              <EmptyState icon="wallet" label="Belum ada pembayaran bulan ini." />
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
        <div className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm dark:border-teal-500/30 dark:bg-teal-500/10">
          <span className="font-bold text-teal-700 dark:text-teal-200">
            Expected Cash Drawer
          </span>
          <span className="text-right text-base font-extrabold tabular-nums text-teal-800 dark:text-teal-100">
            {expectedCash}
          </span>
        </div>
      </section>

      {selectedSale ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
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
            <div className="space-y-3 p-5">
              {[
                ["Customer", selectedSale.customerName],
                [
                  "Operator",
                  operatorLabel({
                    name: selectedSale.cashierName,
                    role: {
                      name: selectedSale.cashierRoleName,
                      slug: selectedSale.cashierRoleSlug,
                    },
                  }),
                ],
                ["Waktu", selectedSale.createdAt],
                ["Payment", selectedSale.paymentMethod],
                ["Transaction Status", selectedSale.transactionStatus],
                ["Payment Status", selectedSale.paymentStatus],
                ["Item", `${selectedSale.itemCount} item`],
                ["Total", selectedSale.subtotal],
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
