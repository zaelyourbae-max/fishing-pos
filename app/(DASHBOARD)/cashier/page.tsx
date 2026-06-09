import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

import KpiActionCard from "@/components/dashboard/kpi-action-card";
import { formatDateTimeID } from "@/lib/date-format";
import { requireCashierPage } from "@/lib/page-guards";
import { getSelfPerformance } from "@/lib/performance";
import { getLowStockWhere } from "@/lib/product-analytics";
import { prisma } from "@/lib/prisma";
import { getStoreStatus } from "@/lib/store-status";
import { transactionIdentityLabel } from "@/lib/transaction-identity";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

function greetingFor(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";

  return "Selamat malam";
}

const TONE_OK =
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
const TONE_WAIT =
  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
const TONE_BAD =
  "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";

/**
 * Gabungkan status transaksi + status bayar jadi SATU label ringkas yang mudah
 * dipahami kasir (mis. "Lunas"), bukan 2-3 status Inggris mentah.
 */
function saleStateBadge(transactionStatus: string, paymentStatus: string) {
  if (transactionStatus === "CANCELLED")
    return { label: "Dibatalkan", tone: TONE_BAD };
  if (paymentStatus === "FAILED") return { label: "Gagal", tone: TONE_BAD };
  if (paymentStatus === "PAID" && transactionStatus === "SUCCESS")
    return { label: "Lunas", tone: TONE_OK };
  if (paymentStatus === "WAITING_PROOF")
    return { label: "Menunggu bukti", tone: TONE_WAIT };
  if (paymentStatus === "UNPAID")
    return { label: "Belum dibayar", tone: TONE_WAIT };

  return { label: "Diproses", tone: TONE_WAIT };
}

function SectionHeader({
  title,
  href,
  action = "Lihat semua",
}: {
  title: string;
  href: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-bold text-teal-700 transition duration-200 hover:bg-teal-50 hover:text-teal-600 active:scale-95 dark:text-teal-300 dark:hover:bg-teal-500/10"
      >
        {action}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
      {label}
    </div>
  );
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

  const [
    todayTransactionCount,
    recentSales,
    lowStockProducts,
    currentUser,
    selfPerf,
  ] = await Promise.all([
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
      take: 6,
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
      take: 6,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
      },
    }),
    prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        name: true,
      },
    }),
    getSelfPerformance(session.sub),
  ]);

  const cashierName = currentUser?.name ?? "Kasir";
  const perfScore = selfPerf.overallScore;
  const perfUp = perfScore !== null && perfScore > 100;
  const perfDown = perfScore !== null && perfScore < 100;
  const greeting = greetingFor(new Date().getHours());
  // Tanggal hari ini (lokal) untuk filter tabel penjualan.
  const todayInput = dateInputValue(todayStart);

  // Tiap kartu KPI langsung membuka tabel terkait yang sudah ter-filter
  // (tanpa popup). /sales otomatis dibatasi ke transaksi kasir yang login.
  const kpiCards: {
    title: string;
    value: string;
    helper: string;
    icon: Parameters<typeof KpiActionCard>[0]["icon"];
    tone: Parameters<typeof KpiActionCard>[0]["tone"];
    href: string;
  }[] = [
    {
      title: "Transaksi Hari Ini",
      value: String(todayTransactionCount),
      helper: "transaksi kamu hari ini",
      icon: "clipboard",
      tone: "blue",
      href: `/sales?from=${todayInput}&to=${todayInput}`,
    },
    {
      title: "Stok Rendah",
      value: String(lowStockProducts.length),
      helper: "produk perlu restok",
      icon: "alert",
      tone: "rose",
      href: "/products?filter=low-stock",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 sm:space-y-5">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.045)] dark:border-white/8 dark:bg-slate-900 sm:p-5 xl:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
              {greeting},{" "}
              <span className="text-teal-600 dark:text-teal-400">
                {cashierName}
              </span>
            </h1>

          </div>
          <Link
            href="/pos"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md active:scale-[0.99]"
          >
            <ReceiptText className="h-5 w-5" />
            Mulai Penjualan
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {kpiCards.map((card, index) => (
          <div
            key={card.title}
            className={`min-w-0 ${
              index === kpiCards.length - 1 && kpiCards.length % 2 === 1
                ? "col-span-2 lg:col-span-1"
                : ""
            }`}
          >
            <KpiActionCard {...card} />
          </div>
        ))}
      </div>

      <Link
        href="/performance"
        className="block min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-teal-500/40 sm:p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
            <Trophy className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Performa Saya · Bulan Ini
            </p>
            <p className="mt-0.5 truncate text-lg font-extrabold text-slate-950 dark:text-white">
              {rupiah(selfPerf.current.omzet)}{" "}
              <span className="text-sm font-bold text-slate-400">
                · {selfPerf.current.txCount} transaksi
              </span>
            </p>
          </div>
          {perfScore !== null ? (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-extrabold ${
                perfUp
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : perfDown
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              }`}
            >
              {perfUp ? (
                <TrendingUp className="h-4 w-4" />
              ) : perfDown ? (
                <TrendingDown className="h-4 w-4" />
              ) : null}
              {perfScore}%
            </span>
          ) : (
            <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-400" />
          )}
        </div>
      </Link>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <SectionHeader title="Transaksi Saya Terakhir" href="/sales" />
          <div className="mt-4 space-y-2.5">
            {recentSales.length === 0 ? (
              <EmptyState label="Belum ada transaksi." />
            ) : null}
            {recentSales.map((sale) => {
              const state = saleStateBadge(
                sale.transactionStatus,
                sale.paymentStatus,
              );

              return (
                <Link
                  key={sale.id}
                  href={`/invoices/${sale.id}`}
                  className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-100 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm active:scale-[0.99] dark:border-slate-800 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">
                      {sale.customer
                        ? `Cust. ${sale.customer.name}`
                        : "Tanpa Customer"}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${state.tone}`}
                      >
                        {state.label}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums text-teal-600 dark:text-teal-400">
                        {rupiah(sale.subtotal)}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
