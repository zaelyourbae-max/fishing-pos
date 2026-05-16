import Link from "next/link";
import { Prisma } from "@prisma/client";

import { requireProtectedPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime, RETURN_REASON_LABELS, rupiah } from "@/lib/returns";
import LiveSearchInput from "@/components/search/live-search-input";

type ReturnsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const session = await requireProtectedPage();
  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const where: Prisma.SaleReturnWhereInput = {
    returnType: "CUSTOMER_RETURN",
    ...(session.role === "cashier" ? { sale: { cashierId: session.sub } } : {}),
    ...(q
      ? {
          OR: [
            {
              sale: {
                invoiceNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
            {
              sale: {
                customer: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              sale: {
                customer: {
                  phone: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              reason: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
  const returns = await prisma.saleReturn.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
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
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Retur Customer</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {session.role === "cashier"
              ? "Retur untuk transaksi milik kasir login."
              : "Barang dikembalikan customer dari invoice penjualan. Retur ini mengurangi omzet bersih."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/returns/new"
            className="rounded-2xl bg-teal-600 px-6 py-4 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Buat Retur Customer
          </Link>
          {session.role !== "cashier" ? (
            <Link
              href="/returns/supplier"
              className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Retur Supplier
            </Link>
          ) : null}
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

      <div className="surface-panel overflow-hidden rounded-3xl">
        <div className="table-scroll">
        <table className="data-table">
          <thead className="bg-slate-100 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th className="p-4 text-left">Tanggal</th>
              <th className="p-4 text-left">Invoice</th>
              <th className="p-4 text-left">Customer</th>
              <th className="p-4 text-left">Kasir</th>
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
                <td className="p-4 text-slate-700 dark:text-slate-300">{saleReturn.sale.cashier.name}</td>
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
    </div>
  );
}
