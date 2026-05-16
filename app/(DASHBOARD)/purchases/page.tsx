import PurchaseForm from "@/components/purchases/purchase-form";
import LiveSearchInput from "@/components/search/live-search-input";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

type PurchasesPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const q = String(params.q ?? "").trim();
  const [suppliers, products, recentPurchases] = await Promise.all([
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
      where: q
        ? {
            OR: [
              {
                purchaseNumber: {
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
      take: 8,
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
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Stock-In Pembelian</h1>
        <p className="mt-3 text-slate-400">
          Catat stok masuk dari supplier resmi.
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
          Belum ada supplier aktif. Tambahkan data supplier sebelum membuat
          pembelian.
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
          Belum ada produk aktif untuk distok.
        </div>
      ) : null}

      <PurchaseForm suppliers={suppliers} products={products} />

      <div className="surface-panel overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-2xl font-bold text-white">Pembelian Terbaru</h2>
          <div className="mt-4">
            <LiveSearchInput
              initialValue={q}
              placeholder="Cari nomor pembelian atau supplier..."
            />
          </div>
        </div>

        <div className="table-scroll">
        <table className="data-table">
          <thead className="bg-[#060B1F] text-sm text-slate-400">
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
                <td className="p-4 font-semibold text-white">
                  {purchase.purchaseNumber}
                </td>
                <td className="p-4 text-slate-300">{purchase.supplier.name}</td>
                <td className="p-4 text-slate-300">
                  {purchase.items.length} item
                </td>
                <td className="p-4 font-semibold tabular-nums text-white">
                  Rp {purchase.total.toLocaleString("id-ID")}
                </td>
                <td className="p-4 text-slate-400">
                  {purchase.createdAt.toLocaleDateString("id-ID")}
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
