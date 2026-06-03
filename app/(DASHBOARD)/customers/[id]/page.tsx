import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  History,
  MapPin,
  MessageCircle,
  ReceiptText,
  Star,
  User,
} from "lucide-react";

import { isOwnerRole } from "@/lib/permissions";
import { formatDateTimeID } from "@/lib/date-format";
import { requireCustomersPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { loyaltyProgressFromValidCount } from "@/lib/loyalty";
import { getLoyaltyConfig } from "@/lib/loyalty-settings";
import { operatorLabel } from "@/lib/transaction-identity";
import PaginationLinks from "@/components/ui/pagination-links";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    history_page?: string;
  }>;
};

const HISTORY_PAGE_SIZE = 8;

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const session = await requireCustomersPage();
  const canViewBusinessSummary = isOwnerRole(session.role);
  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const customerId = Number(id);
  const historyPage = Math.max(Number(queryParams.history_page ?? 1) || 1, 1);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    notFound();
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      customerCode: true,
      name: true,
      phone: true,
      address: true,
      notes: true,
      loyaltyPoints: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    notFound();
  }

  const finalCustomerSaleWhere = {
    customerId: customer.id,
    ...FINAL_SALE_STATUS_WHERE,
  };
  const [summary, sales, totalHistorySales, loyaltyBenefitSales] =
    await Promise.all([
    prisma.sale.aggregate({
      where: finalCustomerSaleWhere,
      _count: {
        _all: true,
      },
      _sum: {
        subtotal: true,
      },
    }),
    prisma.sale.findMany({
      where: finalCustomerSaleWhere,
      orderBy: {
        createdAt: "desc",
      },
      skip: (historyPage - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        subtotal: true,
        paymentMethod: true,
        transactionStatus: true,
        paymentStatus: true,
        loyaltyApplied: true,
        loyaltyMilestone: true,
        loyaltyDiscountAmount: true,
        loyaltyBenefitNote: true,
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
        items: {
          select: {
            qty: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
          orderBy: {
            id: "asc",
          },
        },
        _count: {
          select: {
            items: true,
            returns: true,
          },
        },
      },
    }),
    prisma.sale.count({
      where: finalCustomerSaleWhere,
    }),
    prisma.sale.findMany({
      where: {
        ...finalCustomerSaleWhere,
        loyaltyApplied: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        loyaltyMilestone: true,
        loyaltyDiscountAmount: true,
      },
    }),
  ]);
  const totalSpent = summary._sum.subtotal ?? 0;
  const transactionCount = summary._count._all;
  const averageTransaction =
    transactionCount > 0 ? Math.round(totalSpent / transactionCount) : 0;
  const loyaltyConfig = await getLoyaltyConfig();
  const loyaltyProgress = loyaltyProgressFromValidCount(
    transactionCount,
    loyaltyConfig.interval,
  );
  const historyPageCount = Math.max(
    1,
    Math.ceil(totalHistorySales / HISTORY_PAGE_SIZE),
  );
  const safeHistoryPage = Math.min(historyPage, historyPageCount);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Customer
          </Link>
          <h1 className="page-title mt-4">{customer.name}</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {customer.customerCode} - Data customer aktif dari transaksi POS.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200 sm:h-12 sm:w-12">
            <User className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
            Nama
          </p>
          <p className="mt-0.5 break-words text-base font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-xl">
            {customer.name}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200 sm:h-12 sm:w-12">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
            WhatsApp
          </p>
          <p className="mt-0.5 break-words text-base font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-xl">
            {customer.phone ?? "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200 sm:h-12 sm:w-12">
            <Star className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
            Loyalty Points
          </p>
          <p className="mt-0.5 text-base font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-xl">
            {transactionCount}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs">
            Berdasarkan transaksi valid SUCCESS + PAID.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200 sm:h-12 sm:w-12">
            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
            Terdaftar
          </p>
          <p className="mt-0.5 break-words text-sm font-bold text-slate-950 dark:text-white sm:mt-1 sm:text-xl">
            {formatDateTime(customer.createdAt)}
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Info Customer
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">
                  Alamat
                </p>
                <p className="mt-1 flex items-start gap-2 text-slate-800 dark:text-slate-200">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {customer.address ?? "-"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">
                  Catatan
                </p>
                <p className="mt-1 text-slate-800 dark:text-slate-200">
                  {customer.notes ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Total Transaksi Valid
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                {transactionCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Hanya SUCCESS + PAID.
              </p>
            </div>
            {canViewBusinessSummary ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Total Belanja
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                    {rupiah(totalSpent)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Rata-rata Transaksi
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                    {rupiah(averageTransaction)}
                  </p>
                </div>
              </>
            ) : null}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                Progress Loyalty
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-50">
                {transactionCount}/{loyaltyProgress.nextMilestone}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-100">
                Sisa {loyaltyProgress.remainingToNext} transaksi valid.
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-100">
                Milestone berikutnya: transaksi ke-{loyaltyProgress.nextMilestone}.
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-100">
                S&K benefit: minimal pembelian {rupiah(loyaltyConfig.minPurchase)}.
              </p>
            </div>
            {loyaltyBenefitSales.length > 0 ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm dark:border-teal-500/20 dark:bg-teal-500/10">
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-100">
                  Histori Benefit Loyalty
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  {loyaltyBenefitSales.slice(0, 5).map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/invoices/${sale.id}`}
                      className="block rounded-xl bg-white/70 px-3 py-2 font-semibold text-teal-800 hover:bg-white dark:bg-slate-950/40 dark:text-teal-100"
                    >
                      {sale.invoiceNumber}
                      {sale.loyaltyMilestone
                        ? ` - ke-${sale.loyaltyMilestone}`
                        : ""}
                      {sale.loyaltyDiscountAmount > 0
                        ? ` - ${rupiah(sale.loyaltyDiscountAmount)}`
                        : ""}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                Histori Pembelian
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Read-only dari transaksi yang sudah tersimpan.
              </p>
            </div>
            <History className="h-5 w-5 text-slate-400" />
          </div>

          {sales.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              <ReceiptText className="mb-4 h-12 w-12 text-slate-400" />
              Belum ada transaksi untuk customer ini.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
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
                    {sales.map((sale) => (
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
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          {operatorLabel(sale.cashier)}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          <div className="max-w-xs space-y-1">
                            {sale.items.slice(0, 3).map((item, index) => (
                              <p
                                key={`${sale.id}-${index}`}
                                className="truncate"
                              >
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

              <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
                {sales.map((sale) => (
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
                          {formatDateTime(sale.createdAt)} • Operator{" "}
                          {operatorLabel(sale.cashier)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {sale.paymentMethod} - {sale.transactionStatus} /{" "}
                          {sale.paymentStatus}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {sale.items.slice(0, 3).map((item, index) => (
                            <p
                              key={`${sale.id}-${index}`}
                              className="truncate"
                            >
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
              <PaginationLinks
                currentPage={safeHistoryPage}
                totalItems={totalHistorySales}
                pageSize={HISTORY_PAGE_SIZE}
                hrefForPage={(page) =>
                  page > 1
                    ? `/customers/${customer.id}?history_page=${page}`
                    : `/customers/${customer.id}`
                }
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
