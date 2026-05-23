import Link from "next/link";

import SupplierReturnForm from "@/components/returns/supplier-return-form";
import LiveSearchInput from "@/components/search/live-search-input";
import { formatDateTimeID } from "@/lib/date-format";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/returns";

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

type SupplierReturnPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function SupplierReturnPage({
  searchParams,
}: SupplierReturnPageProps) {
  await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const [suppliers, products, recentReturns] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        stock: {
          gt: 0,
        },
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        costPrice: true,
      },
    }),
    prisma.supplierReturn.findMany({
      where: q
        ? {
            OR: [
              {
                returnNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                reason: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                supplier: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {},
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      select: {
        id: true,
        returnNumber: true,
        reason: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        supplier: {
          select: {
            name: true,
            type: true,
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
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Retur Supplier</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Barang dikembalikan ke supplier/distributor. Stok berkurang dan
            tidak mengurangi omzet penjualan.
          </p>
        </div>

        <div className="responsive-action-row">
          <Link
            href="/returns"
            className="inline-flex min-h-11 items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Retur Customer
          </Link>
          <Link
            href="/returns/new"
            className="inline-flex min-h-11 items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Buat Retur Customer
          </Link>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada supplier/distributor aktif.
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada produk aktif dengan stok tersedia.
        </div>
      ) : null}

      <SupplierReturnForm suppliers={suppliers} products={products} />

      <section className="surface-panel rounded-3xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
          Retur Supplier Terbaru
        </h2>
        <div className="mt-4">
          <LiveSearchInput
            initialValue={q}
            placeholder="Cari nomor retur, supplier, alasan..."
          />
        </div>
        <div className="mt-5 hidden md:block">
        <div className="table-scroll">
          <table className="data-table text-sm">
            <thead>
              <tr>
                <th className="p-4 text-left">Tanggal</th>
                <th className="p-4 text-left">Nomor</th>
                <th className="p-4 text-left">Supplier</th>
                <th className="p-4 text-left">Alasan</th>
                <th className="p-4 text-right">Nilai</th>
                <th className="p-4 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentReturns.length === 0 ? (
                <tr>
                  <td className="p-5 text-slate-500 dark:text-slate-400" colSpan={6}>
                    Belum ada retur supplier.
                  </td>
                </tr>
              ) : null}
              {recentReturns.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">
                    {item.returnNumber}
                    <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                      {item._count.items} item
                    </p>
                  </td>
                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {item.supplier.name}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {item.supplier.type}
                    </p>
                  </td>
                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {item.reason}
                  </td>
                  <td className="p-4 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {rupiah(item.totalAmount)}
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div className="mt-5 mobile-card-list rounded-2xl border border-slate-200 md:hidden dark:border-slate-800">
          {recentReturns.length === 0 ? (
            <div className="mobile-data-card text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada retur supplier.
            </div>
          ) : null}
          {recentReturns.map((item) => (
            <article key={item.id} className="mobile-data-card">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all text-base font-semibold text-slate-900 dark:text-slate-100">
                    {item.returnNumber}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {item.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Supplier
                  </span>
                  <span className="break-words">{item.supplier.name}</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {item.supplier.type}
                  </span>
                </p>
                <p className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Alasan
                  </span>
                  <span className="break-words">{item.reason}</span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Nilai
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {rupiah(item.totalAmount)}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Item
                  </span>
                  {item._count.items} item
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
