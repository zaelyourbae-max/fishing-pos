import Link from "next/link";
import { Prisma } from "@prisma/client";

import { requireReturnsPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime, RETURN_REASON_LABELS, rupiah } from "@/lib/returns";
import LiveSearchInput from "@/components/search/live-search-input";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import PaginationLinks from "@/components/ui/pagination-links";
import { operatorLabel } from "@/lib/transaction-identity";

type ReturnsPageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 8;

function pageHref(page: number, params: { q: string }) {
  const query = new URLSearchParams();

  if (params.q) {
    query.set("q", params.q);
  }

  if (page > 1) {
    query.set("page", String(page));
  }

  const next = query.toString();

  return next ? `/returns?${next}` : "/returns";
}

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const session = await requireReturnsPage();
  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const saleWhere = {
    ...FINAL_SALE_STATUS_WHERE,
    ...(session.role === "cashier" ? { cashierId: session.sub } : {}),
  };
  const where: Prisma.SaleReturnWhereInput = {
    returnType: "CUSTOMER_RETURN",
    sale: saleWhere,
    ...(q
      ? {
          AND: q
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((kw) => ({
              OR: [
                {
                  sale: {
                    invoiceNumber: { contains: kw, mode: "insensitive" as const },
                  },
                },
                {
                  sale: {
                    customer: { name: { contains: kw, mode: "insensitive" as const } },
                  },
                },
                {
                  sale: {
                    customer: { phone: { contains: kw, mode: "insensitive" as const } },
                  },
                },
                { reason: { contains: kw, mode: "insensitive" as const } },
              ],
            })),
        }
      : {}),
  };
  const [returns, totalReturns] = await Promise.all([
    prisma.saleReturn.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reason: true,
        notes: true,
        status: true,
        totalRefund: true,
        createdAt: true,
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
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
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.saleReturn.count({
      where,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalReturns / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Retur Customer</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Barang dikembalikan customer dari invoice penjualan. Retur ini
            mengurangi omzet bersih.
          </p>
        </div>

        <div className="responsive-action-row">
          <Link
            href="/returns/new"
            className="inline-flex min-h-12 items-center rounded-2xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Buat Retur Customer
          </Link>
          <Link
            href="/returns/supplier"
            className="inline-flex min-h-12 items-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Retur Supplier
          </Link>
        </div>
      </div>

      <form className="surface-panel grid gap-3 rounded-3xl p-4 sm:p-5 md:grid-cols-[1fr_auto]">
        <LiveSearchInput
          initialValue={q}
          placeholder="Cari invoice, customer, telepon, alasan..."
        />
        <button className="rounded-2xl bg-teal-600 px-5 py-3 font-semibold text-white">
          Search
        </button>
      </form>

      <div
        data-search-results
        className="surface-panel scroll-mt-24 overflow-hidden rounded-3xl"
      >
        <div className="hidden md:block">
        <div className="table-scroll">
        <table className="data-table">
          <thead className="bg-slate-100 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th className="p-4 text-left">Tanggal</th>
              <th className="p-4 text-left">Invoice</th>
              <th className="p-4 text-left">Customer</th>
              <th className="p-4 text-left">Operator</th>
              <th className="p-4 text-left">Alasan</th>
              <th className="p-4 text-left">Refund</th>
              <th className="p-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 ? (
              <tr>
                <td className="p-5 text-slate-400" colSpan={7}>
                  Belum ada retur.
                </td>
              </tr>
            ) : null}
            {returns.map((saleReturn) => (
              <tr key={saleReturn.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="p-4 text-slate-700 dark:text-slate-300">
                  {formatDateTime(saleReturn.createdAt)}
                </td>
                <td className="p-4">
                  <Link
                    href={`/invoices/${saleReturn.sale.id}`}
                    className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
                  >
                    {saleReturn.sale.invoiceNumber}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {saleReturn._count.items} item retur
                  </p>
                </td>
                <td className="p-4 text-slate-700 dark:text-slate-300">
                  {saleReturn.sale.customer?.name ?? "Walk-in"}
                </td>
                <td className="p-4 text-slate-700 dark:text-slate-300">{operatorLabel(saleReturn.sale.cashier)}</td>
                <td className="p-4 text-slate-700 dark:text-slate-300">
                  {RETURN_REASON_LABELS[
                    saleReturn.reason as keyof typeof RETURN_REASON_LABELS
                  ] ?? saleReturn.reason}
                </td>
                <td className="p-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {rupiah(saleReturn.totalRefund ?? 0)}
                </td>
                <td className="p-4">
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {saleReturn.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
        <div className="mobile-card-list md:hidden">
          {returns.length === 0 ? (
            <div className="mobile-data-card text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada retur.
            </div>
          ) : null}
          {returns.map((saleReturn) => (
            <article key={saleReturn.id} className="mobile-data-card">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/invoices/${saleReturn.sale.id}`}
                    className="break-all text-base font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
                  >
                    {saleReturn.sale.invoiceNumber}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {formatDateTime(saleReturn.createdAt)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {saleReturn.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Customer
                  </span>
                  <span className="break-words">
                    {saleReturn.sale.customer?.name ?? "Walk-in"}
                  </span>
                </p>
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Operator
                  </span>
                  <span className="break-words">{operatorLabel(saleReturn.sale.cashier)}</span>
                </p>
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Alasan
                  </span>
                  <span className="break-words">
                    {RETURN_REASON_LABELS[
                      saleReturn.reason as keyof typeof RETURN_REASON_LABELS
                    ] ?? saleReturn.reason}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Refund
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {rupiah(saleReturn.totalRefund ?? 0)}
                  </span>
                </p>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {saleReturn._count.items} item retur
              </p>
            </article>
          ))}
        </div>
        <PaginationLinks
          currentPage={safePage}
          totalItems={totalReturns}
          pageSize={PAGE_SIZE}
          hrefForPage={(page) => pageHref(page, { q })}
        />
      </div>
    </div>
  );
}
