import Link from "next/link";
import { ArrowRight, Boxes, Lock, ReceiptText, ShoppingCart } from "lucide-react";

import DeadStockCard, {
  type DeadStockCardItem,
} from "@/components/dashboard/dead-stock-card";
import { formatDateTimeID } from "@/lib/date-format";
import { getDeadStockProducts } from "@/lib/dead-stock";
import { requireCashierPage } from "@/lib/page-guards";
import { getLowStockWhere } from "@/lib/product-analytics";
import { prisma } from "@/lib/prisma";
import { getStoreStatus } from "@/lib/store-status";
import { transactionIdentityLabel } from "@/lib/transaction-identity";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-400">
      {label}
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "SUCCESS" || status === "PAID") {
    return "bg-emerald-500/10 text-emerald-300";
  }

  if (status === "PENDING" || status === "WAITING_PROOF") {
    return "bg-amber-500/10 text-amber-300";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "bg-rose-500/10 text-rose-300";
  }

  return "bg-slate-800 text-slate-300";
}

export default async function CashierPage() {
  const session = await requireCashierPage();
  const storeStatus = await getStoreStatus();

  if (!storeStatus.isOpen) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="surface-panel max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Lock size={32} />
          </div>
          <h1 className="page-title mt-5">Toko Sedang Tutup</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Operasional kasir dikunci. Tunggu owner membuka toko kembali untuk
            mulai melayani penjualan.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Sementara menunggu, kamu masih bisa mengubah tema/palet warna lewat
            tombol di pojok atas.
          </p>
        </div>
      </div>
    );
  }

  const todayStart = startOfToday();

  const [todayTransactionCount, recentSales, lowStockProducts, deadStock] =
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
          transactionStatus: true,
          paymentStatus: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
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
          ...getLowStockWhere(),
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
      getDeadStockProducts({
        limit: 5,
      }),
    ]);
  const deadStockItems: DeadStockCardItem[] = deadStock.items.map((product) => {
    const query = product.sku ?? product.name;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      lastSoldAt: product.lastSoldAt?.toISOString() ?? null,
      daysSinceLastSold: product.daysSinceLastSold,
      reason: product.reason,
      detailHref: `/products?q=${encodeURIComponent(query)}`,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard Kasir</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Ringkasan kerja kasir login.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/pos"
          className="rounded-2xl border border-teal-300 bg-teal-600 p-5 text-white transition-colors duration-150 hover:bg-teal-700 sm:col-span-2 xl:col-span-1"
        >
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Shortcut</p>
              <h2 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">Mulai Penjualan</h2>
              <p className="mt-2 text-sm">Buka halaman POS.</p>
            </div>
            <ArrowRight size={28} />
          </div>
        </Link>

        <div className="surface-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Transaksi Saya Hari Ini</p>
              <h2 className="metric-value mt-2 text-3xl">
                {todayTransactionCount}
              </h2>
            </div>
            <ShoppingCart className="text-teal-500" size={28} />
          </div>
        </div>

        <div className="surface-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Stok Rendah</p>
              <h2 className="metric-value mt-2 text-3xl">
                {lowStockProducts.length}
              </h2>
            </div>
            <Boxes className="text-teal-500" size={28} />
          </div>
        </div>

        <div className="surface-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Dead Stock</p>
              <h2 className="metric-value mt-2 text-3xl">
                {deadStock.total}
              </h2>
            </div>
            <Boxes className="text-amber-400" size={28} />
          </div>
        </div>
      </div>

      <section
        id="transactions"
        className="surface-panel rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <ReceiptText className="text-teal-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
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
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all font-semibold text-slate-950 dark:text-white">{sale.invoiceNumber}</p>
                  <p className="mt-1 break-words text-sm text-slate-400">
                    {transactionIdentityLabel({
                      operator: sale.cashier,
                      customer: sale.customer,
                    })} • {sale._count.items} item
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>
                      {sale.transactionStatus}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>
                      {sale.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(sale.createdAt)}
                  </p>
                  {sale.customer?.phone ? (
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {sale.customer.phone}
                    </p>
                  ) : null}
                </div>
                <p className="metric-value tabular-nums text-teal-600 dark:text-teal-400 sm:text-right">
                  {rupiah(sale.subtotal)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface-panel rounded-3xl p-5 sm:p-6">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Stok Rendah Ringan</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStockProducts.length === 0 ? (
            <EmptyState label="Tidak ada produk stok rendah." />
          ) : null}
          {lowStockProducts.map((product) => (
            <div
              key={product.id}
              className="surface-panel-soft flex min-w-0 items-center justify-between gap-3 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-950 dark:text-white">{product.name}</p>
                <p className="break-all text-sm text-slate-500">{product.sku ?? "-"}</p>
              </div>
              <span className="rounded-full bg-teal-500/10 px-3 py-1 text-sm font-semibold tabular-nums text-teal-400">
                {product.stock}
              </span>
            </div>
          ))}
        </div>
      </section>

      <DeadStockCard
        items={deadStockItems}
        total={deadStock.total}
        thresholdDays={deadStock.thresholdDays}
      />
    </div>
  );
}
