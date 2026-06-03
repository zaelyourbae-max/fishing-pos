import Link from "next/link";
import PurchaseForm from "@/components/purchases/purchase-form";
import LiveSearchInput from "@/components/search/live-search-input";
import PaginationLinks from "@/components/ui/pagination-links";
import { formatDateID } from "@/lib/date-format";
import { requireOwnerStoreOpenPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

type PurchasesPageProps = {
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

  return next ? `/purchases?${next}` : "/purchases";
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  await requireOwnerStoreOpenPage();

  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const purchaseWhere = q
    ? {
        AND: q
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((kw) => ({
            OR: [
              { purchaseNumber: { contains: kw, mode: "insensitive" as const } },
              { supplier: { name: { contains: kw, mode: "insensitive" as const } } },
            ],
          })),
      }
    : {};
  const [suppliers, products, recentPurchases, totalPurchases] = await Promise.all([
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
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
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
    prisma.purchase.findMany({
      where: purchaseWhere,
      orderBy: {
        createdAt: "desc",
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.purchase.count({
      where: purchaseWhere,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalPurchases / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Stock-In Pembelian</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Jalur resmi untuk mencatat barang masuk dan menambah stok. Supplier
          bisa distributor, grosir, atau toko kecil tempat owner membeli barang.
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
          Belum ada supplier aktif. Tambahkan data supplier sebelum membuat
          pembelian.
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
          Belum ada produk aktif untuk distok.
        </div>
      ) : null}

      <PurchaseForm suppliers={suppliers} products={products} />

      <div className="surface-panel overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Pembelian Terbaru</h2>
          <div className="mt-4">
            <LiveSearchInput
              initialValue={q}
              placeholder="Cari nomor pembelian atau supplier..."
            />
          </div>
        </div>

        <div className="hidden md:block">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="p-4 text-left">Nomor</th>
              <th className="p-4 text-left">Supplier</th>
              <th className="p-4 text-left">Item</th>
              <th className="p-4 text-left">Total</th>
              <th className="p-4 text-left">Tanggal</th>
              <th className="p-4 text-left"></th>
            </tr>
          </thead>

          <tbody>
            {recentPurchases.length === 0 ? (
              <tr>
                <td className="p-5 text-slate-400" colSpan={5}>
                  Belum ada pembelian.
                </td>
              </tr>
            ) : null}

            {recentPurchases.map((purchase) => (
              <tr key={purchase.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-semibold text-slate-950 dark:text-white">
                  {purchase.purchaseNumber}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-300">{purchase.supplier.name}</td>
                <td className="p-4 text-slate-600 dark:text-slate-300">
                  {purchase.items.length} item
                </td>
                <td className="p-4 font-semibold tabular-nums text-slate-950 dark:text-white">
                  Rp {purchase.total.toLocaleString("id-ID")}
                </td>
                <td className="p-4 text-slate-400">
                  {formatDateID(purchase.createdAt)}
                </td>
                <td className="p-4">
                  <Link
                    href={`/purchases/${purchase.id}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Lihat Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
        <div className="mobile-card-list md:hidden">
          {recentPurchases.length === 0 ? (
            <div className="mobile-data-card text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada pembelian.
            </div>
          ) : null}

          {recentPurchases.map((purchase) => (
            <article key={purchase.id} className="mobile-data-card">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all text-[13px] font-semibold text-slate-950 dark:text-white">
                    {purchase.purchaseNumber}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">
                    {purchase.supplier.name}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-950 dark:text-white">
                  Rp {purchase.total.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Item
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{purchase.items.length} item</span>
                </p>
                <p>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Tanggal
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{formatDateID(purchase.createdAt)}</span>
                </p>
              </div>
              <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                <Link
                  href={`/purchases/${purchase.id}`}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Lihat Detail
                </Link>
              </div>
            </article>
          ))}
        </div>
        <PaginationLinks
          currentPage={safePage}
          totalItems={totalPurchases}
          pageSize={PAGE_SIZE}
          hrefForPage={(page) => pageHref(page, { q })}
        />
      </div>
    </div>
  );
}
