import Link from "next/link";

import SupplierReturnForm from "@/components/returns/supplier-return-form";
import LiveSearchInput from "@/components/search/live-search-input";
import { formatDateTimeID } from "@/lib/date-format";
import { requireOwnerStoreOpenPage } from "@/lib/page-guards";
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
  await requireOwnerStoreOpenPage();

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
            AND: q
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((kw) => ({
                OR: [
                  { returnNumber: { contains: kw, mode: "insensitive" as const } },
                  { reason: { contains: kw, mode: "insensitive" as const } },
                  {
                    supplier: {
                      name: { contains: kw, mode: "insensitive" as const },
                    },
                  },
                ],
              })),
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

      <section
        data-search-results
        className="surface-panel scroll-mt-24 rounded-3xl p-5 sm:p-6"
      >
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
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    {item.returnNumber}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {item.status}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p className="min-w-0">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Supplier
                  </span>
                  <span className="line-clamp-1 break-words font-medium text-slate-800 dark:text-slate-200">{item.supplier.name}</span>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                    {item.supplier.type}
                  </span>
                </p>
                <p className="min-w-0">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Alasan
                  </span>
                  <span className="line-clamp-1 break-words font-medium text-slate-800 dark:text-slate-200">{item.reason}</span>
                </p>
                <p>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Nilai
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {rupiah(item.totalAmount)}
                  </span>
                </p>
                <p>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Item
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item._count.items} item</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
