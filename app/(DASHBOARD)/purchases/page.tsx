import PurchaseForm from "@/components/purchases/purchase-form";
import LiveSearchInput from "@/components/search/live-search-input";
import PaginationLinks from "@/components/ui/pagination-links";
import { formatDateID } from "@/lib/date-format";
import { requireOwnerPage } from "@/lib/page-guards";
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
  await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const purchaseWhere = q
    ? {
        OR: [
          {
            purchaseNumber: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
          {
            supplier: {
              name: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          },
        ],
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
          Catat stok masuk dari supplier resmi.
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
              <tr key={purchase.id} className="border-t border-slate-200 dark:border-slate-800">
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
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all text-base font-semibold text-slate-950 dark:text-white">
                    {purchase.purchaseNumber}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                    {purchase.supplier.name}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-slate-950 dark:text-white">
                  Rp {purchase.total.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Item
                  </span>
                  {purchase.items.length} item
                </p>
                <p>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Tanggal
                  </span>
                  {formatDateID(purchase.createdAt)}
                </p>
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
