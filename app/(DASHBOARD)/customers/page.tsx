import Link from "next/link";
import { ArrowUpRight, History, MapPin, Search, Users } from "lucide-react";
import { Prisma } from "@prisma/client";

import LiveSearchInput from "@/components/search/live-search-input";
import { formatDateID } from "@/lib/date-format";
import { isOwnerRole } from "@/lib/permissions";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { requireCustomersPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import PaginationLinks from "@/components/ui/pagination-links";

type CustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 8;

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(date: Date) {
  return formatDateID(date);
}

function customerWhere(q: string): Prisma.CustomerWhereInput {
  const normalizedPhone = normalizeIndonesianPhone(q);

  return {
    isActive: true,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: normalizedPhone || q,
                mode: "insensitive",
              },
            },
            {
              customerCode: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
}

function pageHref(page: number, params: { q: string }) {
  const query = new URLSearchParams();

  if (params.q) {
    query.set("q", params.q);
  }

  if (page > 1) {
    query.set("page", String(page));
  }

  const next = query.toString();

  return next ? `/customers?${next}` : "/customers";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await requireCustomersPage();
  const canViewAnalytics = isOwnerRole(session.role);
  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const where = customerWhere(q);
  const [customers, totalCustomers] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        customerCode: true,
        name: true,
        phone: true,
        address: true,
        loyaltyPoints: true,
        createdAt: true,
        _count: {
          select: {
            sales: true,
          },
        },
      },
    }),
    prisma.customer.count({
      where,
    }),
  ]);
  const customerIds = customers.map((customer) => customer.id);
  const salesSummary =
    canViewAnalytics && customerIds.length
      ? await prisma.sale.groupBy({
          by: ["customerId"],
          where: {
            customerId: {
              in: customerIds,
            },
            ...FINAL_SALE_STATUS_WHERE,
          },
          _sum: {
            subtotal: true,
          },
          _count: {
            _all: true,
          },
        })
      : [];
  const summaryByCustomer = new Map(
    salesSummary
      .filter((summary) => summary.customerId !== null)
      .map((summary) => [summary.customerId as number, summary]),
  );
  const pageCount = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);

  return (
    <div className="space-y-3 sm:space-y-7">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Customer</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:mt-3 sm:text-base">
            Data customer aktif dari transaksi POS. Kasir melihat data
            operasional dasar, owner dan developer melihat histori pembelian
            read-only.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          <Users className="h-4 w-4 text-teal-600" />
          {totalCustomers} customer tampil
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-4">
        <LiveSearchInput
          initialValue={q}
          placeholder="Cari nama customer, WhatsApp, atau kode customer..."
        />
      </section>

      <section
        data-search-results
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
      >
        <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-5">
          <h2 className="text-base font-bold text-slate-950 dark:text-white sm:text-xl">
            Daftar Customer
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-sm">
            Klik customer untuk melihat detail dan histori yang diizinkan role.
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center p-5 text-center sm:min-h-72 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-16 sm:w-16">
              <Search className="h-5 w-5 sm:h-8 sm:w-8" />
            </span>
            <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white sm:mt-4 sm:text-base">
              Customer tidak ditemukan
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-sm">
              Coba gunakan nama, nomor WhatsApp, atau kode customer lain.
            </p>
          </div>
        ) : null}

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">WhatsApp</th>
                <th className="px-5 py-4">Alamat</th>
                <th className="px-5 py-4 text-right">Poin</th>
                {canViewAnalytics ? (
                  <>
                    <th className="px-5 py-4 text-right">Transaksi</th>
                    <th className="px-5 py-4 text-right">Total Belanja</th>
                  </>
                ) : null}
                <th className="px-5 py-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {customers.map((customer) => {
                const summary = summaryByCustomer.get(customer.id);

                return (
                  <tr key={customer.id} className="text-sm">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-950 dark:text-white">
                        {customer.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {customer.customerCode} - Sejak {formatDate(customer.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                      {customer.phone ?? "-"}
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-700 dark:text-slate-300">
                      <span className="line-clamp-2">
                        {customer.address ?? "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                      {customer.loyaltyPoints}
                    </td>
                    {canViewAnalytics ? (
                      <>
                        <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                          {summary?._count._all ?? customer._count.sales}
                        </td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                          {rupiah(summary?._sum.subtotal ?? 0)}
                        </td>
                      </>
                    ) : null}
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-teal-300 px-4 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 dark:border-teal-500/50 dark:text-teal-200 dark:hover:bg-teal-500/10"
                      >
                        Detail
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
          {customers.map((customer) => {
            const summary = summaryByCustomer.get(customer.id);

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-900 sm:p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 break-words text-[13px] font-bold leading-snug text-slate-950 dark:text-white sm:text-sm">
                      {customer.name}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-slate-500">
                      {customer.phone ?? "WhatsApp belum ada"}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {customer.customerCode} - Sejak {formatDate(customer.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200 sm:text-[11px]">
                    {customer.loyaltyPoints} poin
                  </span>
                </div>
                <div className="mt-1.5 grid gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 sm:mt-2 sm:gap-2 sm:text-xs">
                  <p className="flex min-w-0 items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 line-clamp-1 break-words">
                      {customer.address ?? "-"}
                    </span>
                  </p>
                  {canViewAnalytics ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-900 sm:rounded-xl sm:py-1.5">
                        <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <History className="h-3.5 w-3.5" />
                          Transaksi
                        </p>
                        <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {summary?._count._all ?? customer._count.sales}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-900 sm:rounded-xl sm:py-1.5">
                        <p className="text-[11px] font-medium text-slate-400">
                          Total belanja
                        </p>
                        <p className="mt-0.5 truncate font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {rupiah(summary?._sum.subtotal ?? 0)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
        <PaginationLinks
          currentPage={safePage}
          totalItems={totalCustomers}
          pageSize={PAGE_SIZE}
          hrefForPage={(page) => pageHref(page, { q })}
        />
      </section>
    </div>
  );
}
