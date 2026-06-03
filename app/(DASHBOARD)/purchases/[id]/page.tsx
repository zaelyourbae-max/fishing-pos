import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTimeID } from "@/lib/date-format";
import { requireOwnerStoreOpenPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

type PurchaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default async function PurchaseDetailPage({ params }: PurchaseDetailPageProps) {
  await requireOwnerStoreOpenPage();

  const { id } = await params;

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      user: { select: { name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  if (!purchase) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/purchases"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="page-title">{purchase.purchaseNumber}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Detail pembelian
            </p>
          </div>
        </div>
        <Link
          href={`/purchases/${purchase.id}/print`}
          target="_blank"
          className="flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
        >
          <Download size={16} />
          Download PDF
        </Link>
      </div>

      {/* Info kartu */}
      <div className="surface-panel rounded-3xl p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Informasi Pembelian</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Nomor PO</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white break-all">{purchase.purchaseNumber}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Supplier</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{purchase.supplier.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Tanggal</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {formatDateTimeID(purchase.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Dicatat oleh</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {purchase.user?.name ?? "-"}
            </p>
          </div>
        </div>

        {purchase.notes ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Catatan</p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">{purchase.notes}</p>
          </div>
        ) : null}
      </div>

      {/* Tabel items */}
      <div className="surface-panel overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            Item Pembelian
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({purchase.items.length} produk)
            </span>
          </h2>
        </div>

        {/* Desktop */}
        <div className="hidden md:block table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="p-4 text-left">Produk</th>
                <th className="p-4 text-left">SKU</th>
                <th className="p-4 text-right">Qty</th>
                <th className="p-4 text-right">Harga Beli</th>
                <th className="p-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-4 font-medium text-slate-900 dark:text-white">{item.product.name}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{item.product.sku ?? "-"}</td>
                  <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{item.qty}</td>
                  <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{rupiah(item.costPrice)}</td>
                  <td className="p-4 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{rupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="mobile-card-list md:hidden">
          {purchase.items.map((item) => (
            <article key={item.id} className="mobile-data-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] text-slate-900 dark:text-white">{item.product.name}</p>
                  {item.product.sku ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.product.sku}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-[13px] tabular-nums text-slate-900 dark:text-white">
                  {rupiah(item.subtotal)}
                </p>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Qty</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.qty}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Harga Beli</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{rupiah(item.costPrice)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 sm:px-6 flex justify-end">
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pembelian</p>
            <p className="metric-value text-2xl">{rupiah(purchase.total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
