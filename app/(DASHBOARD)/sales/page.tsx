import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  Banknote,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Landmark,
  QrCode,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import { requireProtectedPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import LiveSearchInput from "@/components/search/live-search-input";
import CancelSaleButton from "@/components/sales/cancel-sale-button";
import PaymentProofActionButton from "@/components/sales/payment-proof-action-button";
import PendingExpiryCountdown from "@/components/sales/pending-expiry-countdown";
import SalesDateFilterFields from "@/components/sales/sales-date-filter-fields";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { operatorLabel } from "@/lib/transaction-identity";

type SalesPageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    cashier?: string;
    payment?: string;
    q?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 7;

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function dateRange(from?: string, to?: string) {
  const createdAt: Prisma.DateTimeFilter = {};

  if (from) {
    createdAt.gte = new Date(`${from}T00:00:00`);
  }

  if (to) {
    createdAt.lte = new Date(`${to}T23:59:59`);
  }

  return Object.keys(createdAt).length ? createdAt : undefined;
}

function displayDate(value?: string) {
  if (!value) {
    return "";
  }

  return formatDateID(value);
}

function paymentIcon(paymentMethod: string) {
  const method = paymentMethod.toUpperCase();

  if (method.includes("QRIS")) {
    return <QrCode className="h-4 w-4" />;
  }

  if (method.includes("TRANSFER") || method.includes("BANK")) {
    return <Landmark className="h-4 w-4" />;
  }

  return <Banknote className="h-4 w-4" />;
}

function statusBadgeClass(status: string) {
  if (status === "SUCCESS" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (status === "PENDING" || status === "WAITING_PROOF") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function buildHref(
  params: Record<string, string | undefined>,
  nextPage: number,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  if (nextPage > 1) {
    query.set("page", String(nextPage));
  }

  const queryString = query.toString();

  return queryString ? `/sales?${queryString}` : "/sales";
}

function returnedAmount(
  returns: {
    totalRefund: number | null;
    items: {
      subtotal: number;
    }[];
  }[],
) {
  return returns.reduce((total, saleReturn) => {
    const fallback = saleReturn.items.reduce(
      (itemTotal, item) => itemTotal + item.subtotal,
      0,
    );

    return total + (saleReturn.totalRefund ?? fallback);
  }, 0);
}

function saleDiscountAmount(items: { discountAmount: unknown }[]) {
  return items.reduce(
    (total, item) => total + Math.round(Number(item.discountAmount ?? 0)),
    0,
  );
}

function isPendingQrisSale(sale: {
  paymentMethod: string;
  transactionStatus: string;
  paymentStatus: string;
}) {
  const method = sale.paymentMethod.toUpperCase();

  return (
    (method.includes("QRIS") ||
      method.includes("TRANSFER") ||
      method.includes("BANK")) &&
    sale.transactionStatus === "PENDING" &&
    sale.paymentStatus === "WAITING_PROOF"
  );
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const session = await requireProtectedPage();
  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const payment = String(params.payment ?? "").trim();
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const dateFilter = dateRange(params.from, params.to);
  const cashierId =
    session.role === "cashier"
      ? session.sub
      : params.cashier
        ? Number(params.cashier)
        : null;
  const where: Prisma.SaleWhereInput = {
    ...(cashierId ? { cashierId } : {}),
    ...(payment ? { paymentMethod: payment } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(q
      ? {
          OR: [
            {
              invoiceNumber: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              customer: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
            {
              customer: {
                phone: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  };
  const finalSaleWhere: Prisma.SaleWhereInput = {
    ...where,
    ...FINAL_SALE_STATUS_WHERE,
  };

  const [sales, totals, revenueTotals, customerReturns, cashiers, paymentMethods] =
    await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          invoiceNumber: true,
          createdAt: true,
          subtotal: true,
          paymentMethod: true,
          transactionStatus: true,
          paymentStatus: true,
          paymentProofUrl: true,
          expiredAt: true,
          cancelReason: true,
          cancelledAt: true,
          loyaltyApplied: true,
          loyaltyMilestone: true,
          loyaltyDiscountAmount: true,
          cashier: {
            select: {
              name: true,
              role: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
          customer: {
            select: {
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              discountAmount: true,
            },
          },
          returns: {
            where: {
              returnType: "CUSTOMER_RETURN",
            },
            select: {
              totalRefund: true,
              items: {
                select: {
                  subtotal: true,
                },
              },
            },
          },
        },
      }),
      prisma.sale.aggregate({
        where,
        _count: {
          _all: true,
        },
        _sum: {
          subtotal: true,
        },
      }),
      prisma.sale.aggregate({
        where: finalSaleWhere,
        _sum: {
          subtotal: true,
        },
      }),
      prisma.saleReturn.findMany({
        where: {
          returnType: "CUSTOMER_RETURN",
          sale: finalSaleWhere,
        },
        select: {
          totalRefund: true,
          items: {
            select: {
              subtotal: true,
            },
          },
        },
      }),
      session.role === "cashier"
        ? Promise.resolve([])
        : prisma.user.findMany({
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              name: true,
              role: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          }),
      prisma.paymentMethod.findMany({
        orderBy: {
          code: "asc",
        },
        select: {
          code: true,
          name: true,
        },
      }),
    ]);
  const paymentLabel = new Map(
    paymentMethods.map((method) => [method.code, method.name]),
  );
  const totalRefund = returnedAmount(customerReturns);
  const totalSales = totals._count._all;
  const netOmzet = (revenueTotals._sum.subtotal ?? 0) - totalRefund;
  const pageCount = Math.max(1, Math.ceil(totalSales / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const rangeLabel =
    params.from || params.to
      ? `${displayDate(params.from) || "Awal"} - ${displayDate(params.to) || "Hari ini"}`
      : "Semua tanggal";
  const pageParams = {
    from: params.from,
    to: params.to,
    cashier: session.role === "cashier" ? undefined : params.cashier,
    payment,
    q,
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Riwayat Penjualan</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:mt-3 sm:text-base">
            {session.role === "cashier"
              ? "Transaksi milik kasir login."
              : "Semua transaksi dengan filter dasar."}
          </p>
        </div>
        <div className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 sm:min-h-12 sm:gap-3 sm:px-4 sm:py-2 sm:text-sm">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="min-w-0 break-words">{rangeLabel}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-4">
        <div className="grid gap-2.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-[180px_180px_1fr_1fr_1.2fr_160px]">
          <SalesDateFilterFields from={params.from} to={params.to} />

          {session.role !== "cashier" ? (
            <label className="space-y-1.5 sm:space-y-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Operator
              </span>
              <select
                name="cashier"
                defaultValue={params.cashier ?? ""}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:px-4"
              >
                <option value="">Semua Operator</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {operatorLabel(cashier)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="cashier" value={String(session.sub)} />
          )}

          <label className="space-y-1.5 sm:space-y-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Metode Pembayaran
            </span>
            <select
              name="payment"
              defaultValue={payment}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:px-4"
            >
              <option value="">Semua Payment</option>
              {paymentMethods.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 sm:space-y-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Invoice / Customer
            </span>
            <LiveSearchInput
              initialValue={q}
              placeholder="Cari invoice, customer, telepon..."
            />
          </label>

          <button className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-700 sm:h-12 sm:px-5">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:gap-5 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-16 sm:w-16">
            <ShoppingCart className="h-5 w-5 sm:h-8 sm:w-8" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Transaksi
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-2xl">
              {totalSales}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
              Transaksi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:gap-5 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-16 sm:w-16">
            <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Omzet
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-2xl">
              {rupiah(netOmzet)}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
              Total penjualan
            </p>
          </div>
        </div>
      </div>

      <div
        data-search-results
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
      >
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Invoice</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Operator</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sales.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={8}>
                    Tidak ada transaksi sesuai filter.
                  </td>
                </tr>
              ) : null}
              {sales.map((sale) => {
                const refund = returnedAmount(sale.returns);
                const hasReturn = refund > 0;
                const discountTotal = saleDiscountAmount(sale.items);
                const paymentName =
                  paymentLabel.get(sale.paymentMethod) ?? sale.paymentMethod;
                const isPendingQris = isPendingQrisSale(sale);

                return (
                  <tr key={sale.id} className="text-sm">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">
                        {sale.invoiceNumber}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {sale.items.length} item
                        </span>
                        {hasReturn ? (
                          <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                            Ada retur
                          </span>
                        ) : null}
                        {discountTotal > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                            Diskon {rupiah(discountTotal)}
                          </span>
                        ) : null}
                        {sale.loyaltyApplied ? (
                          <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                            Loyalty
                            {sale.loyaltyMilestone
                              ? ` ke-${sale.loyaltyMilestone}`
                              : ""}
                          </span>
                        ) : null}
                        {sale.transactionStatus === "CANCELLED" ? (
                          <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                            Dibatalkan
                          </span>
                        ) : null}
                        {isPendingQris ? (
                          <PendingExpiryCountdown
                            expiredAt={sale.expiredAt?.toISOString() ?? null}
                          />
                        ) : null}
                      </div>
                      {sale.transactionStatus === "CANCELLED" && sale.cancelReason ? (
                        <p className="mt-2 max-w-xs text-xs text-rose-600 dark:text-rose-300">
                          {sale.cancelReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {sale.customer?.name ?? "Walk-in"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {operatorLabel(sale.cashier)}
                    </td>
                    <td
                      className={`px-5 py-4 font-bold tabular-nums ${
                        hasReturn
                          ? "text-rose-600 dark:text-rose-300"
                          : "text-slate-950 dark:text-white"
                      }`}
                    >
                      {hasReturn ? `- ${rupiah(refund)}` : rupiah(sale.subtotal)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        {paymentIcon(sale.paymentMethod)}
                        {paymentName}
                      </span>
                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>
                        {sale.transactionStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isPendingQris ? (
                          <PaymentProofActionButton
                            saleId={sale.id}
                            invoiceNumber={sale.invoiceNumber}
                          />
                        ) : null}
                        {sale.transactionStatus === "PENDING" ? (
                          <CancelSaleButton
                            saleId={sale.id}
                            invoiceNumber={sale.invoiceNumber}
                          />
                        ) : null}
                        <Link
                          href={`/invoices/${sale.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-teal-300 px-4 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 dark:border-teal-500/50 dark:text-teal-200 dark:hover:bg-teal-500/10"
                        >
                          Invoice
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
          {sales.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Tidak ada transaksi sesuai filter.
            </div>
          ) : null}
          {sales.map((sale) => {
            const refund = returnedAmount(sale.returns);
            const hasReturn = refund > 0;
            const discountTotal = saleDiscountAmount(sale.items);
            const paymentName =
              paymentLabel.get(sale.paymentMethod) ?? sale.paymentMethod;
            const isPendingQris = isPendingQrisSale(sale);

            return (
              <div key={sale.id} className="p-2.5 sm:p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-[13px] font-bold leading-snug text-slate-950 dark:text-white sm:text-sm">
                      {sale.invoiceNumber}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formatDateTime(sale.createdAt)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-right text-sm font-bold tabular-nums ${
                      hasReturn
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-slate-950 dark:text-white"
                    }`}
                  >
                    {hasReturn ? `- ${rupiah(refund)}` : rupiah(sale.subtotal)}
                  </p>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 sm:mt-2 sm:gap-y-1.5 sm:text-xs">
                  <p className="min-w-0">
                    <span className="block text-[11px] font-medium text-slate-400">
                      Customer
                    </span>
                    <span className="line-clamp-1 break-words">
                      {sale.customer?.name ?? "Walk-in"}
                    </span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-[11px] font-medium text-slate-400">
                      Operator
                    </span>
                    <span className="line-clamp-1 break-words">
                      {operatorLabel(sale.cashier)}
                    </span>
                  </p>
                  <p className="col-span-2 flex min-w-0 items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">
                      Payment
                    </span>
                    {paymentIcon(sale.paymentMethod)}
                    <span className="min-w-0 truncate">{paymentName}</span>
                  </p>
                  <div className="col-span-2 flex min-w-0 items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">
                      Item
                    </span>
                    <span>{sale.items.length} item</span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClass(sale.transactionStatus)}`}>
                    {sale.transactionStatus}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClass(sale.paymentStatus)}`}>
                    {sale.paymentStatus}
                  </span>
                  {hasReturn ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                      Retur
                    </span>
                  ) : null}
                  {discountTotal > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                      Diskon {rupiah(discountTotal)}
                    </span>
                  ) : null}
                  {sale.loyaltyApplied ? (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                      Loyalty
                      {sale.loyaltyMilestone ? ` ke-${sale.loyaltyMilestone}` : ""}
                    </span>
                  ) : null}
                  {sale.transactionStatus === "CANCELLED" ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                      Dibatalkan
                    </span>
                  ) : null}
                  {isPendingQris ? (
                    <PendingExpiryCountdown
                      expiredAt={sale.expiredAt?.toISOString() ?? null}
                    />
                  ) : null}
                </div>
                {sale.transactionStatus === "CANCELLED" && sale.cancelReason ? (
                  <p className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {sale.cancelReason}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap justify-end gap-1.5 sm:mt-3 sm:gap-2">
                  {isPendingQris ? (
                    <PaymentProofActionButton
                      saleId={sale.id}
                      invoiceNumber={sale.invoiceNumber}
                    />
                  ) : null}
                  {sale.transactionStatus === "PENDING" ? (
                    <CancelSaleButton
                      saleId={sale.id}
                      invoiceNumber={sale.invoiceNumber}
                    />
                  ) : null}
                  <Link
                    href={`/invoices/${sale.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-teal-300 px-3 text-xs font-semibold text-teal-700 dark:border-teal-500/50 dark:text-teal-200 sm:h-9"
                  >
                    Invoice
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Menampilkan{" "}
            {totalSales === 0
              ? "0"
              : `${(safePage - 1) * PAGE_SIZE + 1} - ${Math.min(
                  safePage * PAGE_SIZE,
                  totalSales,
                )}`}{" "}
            dari {totalSales} data
          </p>
          <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              aria-disabled={safePage === 1}
              href={buildHref(pageParams, Math.max(1, safePage - 1))}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:text-slate-300 ${
                safePage === 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .slice(0, 5)
              .map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildHref(pageParams, pageNumber)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm ${
                    pageNumber === safePage
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}
            <Link
              aria-disabled={safePage === pageCount}
              href={buildHref(pageParams, Math.min(pageCount, safePage + 1))}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:text-slate-300 ${
                safePage === pageCount ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
