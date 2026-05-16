import Link from "next/link";
import { ArrowRight, Boxes, ReceiptText, ShoppingCart } from "lucide-react";

import { requireCashierPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

const LOW_STOCK_LIMIT = 10;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-400">
      {label}
    </div>
  );
}

export default async function CashierPage() {
  const session = await requireCashierPage();
  const todayStart = startOfToday();

  const [todayTransactionCount, recentSales, lowStockProducts] =
    await Promise.all([
      prisma.sale.count({
        where: {
          cashierId: session.sub,
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.sale.findMany({
        where: {
          cashierId: session.sub,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          subtotal: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          stock: {
            lt: LOW_STOCK_LIMIT,
          },
        },
        orderBy: {
          stock: "asc",
        },
        take: 5,
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard Kasir</h1>
        <p className="mt-2 text-slate-300">Ringkasan kerja kasir login.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/pos"
          className="rounded-2xl border border-teal-300 bg-teal-600 p-5 text-white transition-colors duration-150 hover:bg-teal-700"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Shortcut</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Mulai Penjualan</h2>
              <p className="mt-2 text-sm">Buka halaman POS.</p>
            </div>
            <ArrowRight size={28} />
          </div>
        </Link>

        <div className="surface-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Transaksi Saya Hari Ini</p>
              <h2 className="metric-value mt-2 text-3xl text-white">
                {todayTransactionCount}
              </h2>
            </div>
            <ShoppingCart className="text-teal-500" size={28} />
          </div>
        </div>

        <div className="surface-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Stok Rendah</p>
              <h2 className="metric-value mt-2 text-3xl text-white">
                {lowStockProducts.length}
              </h2>
            </div>
            <Boxes className="text-teal-500" size={28} />
          </div>
        </div>
      </div>

      <section
        id="transactions"
        className="surface-panel rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <ReceiptText className="text-teal-500" size={24} />
          <h2 className="text-2xl font-bold text-white">
            Transaksi Saya Terakhir
          </h2>
        </div>

        <div className="space-y-3">
          {recentSales.length === 0 ? (
            <EmptyState label="Belum ada transaksi." />
          ) : null}

          {recentSales.map((sale) => (
            <Link
              key={sale.id}
              href={`/invoices/${sale.id}`}
              className="surface-panel-soft block rounded-2xl p-4 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{sale.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {sale.customer?.name ?? "Walk-in"} - {sale._count.items} item
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(sale.createdAt)}
                  </p>
                  {sale.customer?.phone ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {sale.customer.phone}
                    </p>
                  ) : null}
                </div>
                <p className="metric-value text-teal-400">{rupiah(sale.subtotal)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface-panel rounded-3xl p-5 sm:p-6">
        <h2 className="text-2xl font-bold text-white">Stok Rendah Ringan</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStockProducts.length === 0 ? (
            <EmptyState label="Tidak ada produk stok rendah." />
          ) : null}
          {lowStockProducts.map((product) => (
            <div
              key={product.id}
              className="surface-panel-soft flex items-center justify-between rounded-2xl p-4"
            >
              <div>
                <p className="font-semibold text-white">{product.name}</p>
                <p className="text-sm text-slate-500">{product.sku ?? "-"}</p>
              </div>
              <span className="rounded-full bg-teal-500/10 px-3 py-1 text-sm font-semibold tabular-nums text-teal-400">
                {product.stock}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
