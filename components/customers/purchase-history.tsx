"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  ReceiptText,
} from "lucide-react";

import { formatDateTimeID } from "@/lib/date-format";
import { operatorLabel } from "@/lib/transaction-identity";

type SaleItem = {
  qty: number;
  product: {
    name: string;
    sku: string | null;
  };
};

type Sale = {
  id: string;
  invoiceNumber: string;
  createdAt: Date | string;
  subtotal: number;
  paymentMethod: string;
  transactionStatus: string;
  paymentStatus: string;
  loyaltyApplied: boolean;
  loyaltyMilestone: number | null;
  loyaltyDiscountAmount: number;
  loyaltyBenefitNote: string | null;
  cashier: {
    name: string | null;
    role: {
      name: string | null;
      slug: string | null;
    } | null;
  } | null;
  items: SaleItem[];
  _count: {
    items: number;
    returns: number;
  };
};

type PurchaseHistoryProps = {
  sales: Sale[];
  canViewBusinessSummary: boolean;
  pageSize?: number;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// Daftar nomor halaman yang tampil (maksimal 5), ala PaginationLinks.
function visiblePages(currentPage: number, pageCount: number) {
  const maxVisible = 5;

  if (pageCount <= maxVisible) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, pageCount - maxVisible + 1));

  return Array.from({ length: maxVisible }, (_, index) => start + index);
}

// Histori pembelian yang bisa dilipat + pindah halaman tanpa reload (client-side).
export default function PurchaseHistory({
  sales,
  canViewBusinessSummary,
  pageSize = 8,
}: PurchaseHistoryProps) {
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(1);

  const total = sales.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pageSales = sales.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageButtonBase =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors duration-200 sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
      >
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 shrink-0 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            Histori Pembelian
          </h2>
          {total > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {total}
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        total === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center border-t border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <ReceiptText className="mb-4 h-12 w-12 text-slate-400" />
            Belum ada transaksi untuk customer ini.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-slate-200 lg:block dark:border-slate-800">
              <table className="w-full min-w-[920px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-5 py-4">Tanggal</th>
                    <th className="px-5 py-4">Operator</th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pageSales.map((sale) => (
                    <tr key={sale.id} className="text-sm">
                      <td className="px-5 py-4">
                        <Link
                          href={`/invoices/${sale.id}`}
                          className="font-bold text-teal-700 hover:text-teal-600 dark:text-teal-300"
                        >
                          {sale.invoiceNumber}
                        </Link>
                        {canViewBusinessSummary && sale._count.returns > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                            Ada retur
                          </p>
                        ) : null}
                        {sale.loyaltyApplied ? (
                          <p className="mt-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                            Loyalty
                            {sale.loyaltyMilestone
                              ? ` ke-${sale.loyaltyMilestone}`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        {formatDateTimeID(sale.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        {operatorLabel(sale.cashier)}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        <div className="max-w-xs space-y-1">
                          {sale.items.slice(0, 3).map((item, index) => (
                            <p key={`${sale.id}-${index}`} className="truncate">
                              {item.product.name} x{item.qty}
                            </p>
                          ))}
                          {sale.items.length > 3 ? (
                            <p className="text-xs font-semibold text-slate-500">
                              +{sale.items.length - 3} item lain
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        {sale.paymentMethod}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {sale.transactionStatus} / {sale.paymentStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                        {rupiah(sale.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 border-t border-slate-200 lg:hidden dark:divide-slate-800 dark:border-slate-800">
              {pageSales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/invoices/${sale.id}`}
                  className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950 dark:text-white">
                        {sale.invoiceNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDateTimeID(sale.createdAt)} • Operator{" "}
                        {operatorLabel(sale.cashier)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {sale.paymentMethod} - {sale.transactionStatus} /{" "}
                        {sale.paymentStatus}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {sale.items.slice(0, 3).map((item, index) => (
                          <p key={`${sale.id}-${index}`} className="truncate">
                            {item.product.name} x{item.qty}
                          </p>
                        ))}
                        {sale.items.length > 3 ? (
                          <p className="font-semibold text-slate-500">
                            +{sale.items.length - 3} item lain
                          </p>
                        ) : null}
                      </div>
                      {sale.loyaltyApplied ? (
                        <p className="mt-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                          Loyalty
                          {sale.loyaltyMilestone
                            ? ` ke-${sale.loyaltyMilestone}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-slate-950 dark:text-white">
                      {rupiah(sale.subtotal)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 border-t border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Menampilkan {from} - {to} dari {total} transaksi
              </p>
              <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  disabled={safePage === 1}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900 ${
                    safePage === 1 ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {visiblePages(safePage, pageCount).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`${pageButtonBase} ${
                      pageNumber === safePage
                        ? "border-teal-200 bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                        : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  disabled={safePage === pageCount}
                  onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900 ${
                    safePage === pageCount ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
