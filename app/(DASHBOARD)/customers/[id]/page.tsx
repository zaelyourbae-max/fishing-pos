import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  History,
  MapPin,
  MessageCircle,
  ReceiptText,
  Star,
  User,
} from "lucide-react";

import { isOwnerRole } from "@/lib/permissions";
import { requireCustomersPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const session = await requireCustomersPage();
  const canViewHistory = isOwnerRole(session.role);
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    notFound();
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      customerCode: true,
      name: true,
      phone: true,
      address: true,
      notes: true,
      loyaltyPoints: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    notFound();
  }

  const [summary, sales] = canViewHistory
    ? await Promise.all([
        prisma.sale.aggregate({
          where: {
            customerId: customer.id,
            ...FINAL_SALE_STATUS_WHERE,
          },
          _count: {
            _all: true,
          },
          _sum: {
            subtotal: true,
          },
        }),
        prisma.sale.findMany({
          where: {
            customerId: customer.id,
            ...FINAL_SALE_STATUS_WHERE,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 25,
          select: {
            id: true,
            invoiceNumber: true,
            createdAt: true,
            subtotal: true,
            paidAmount: true,
            paymentMethod: true,
            cashier: {
              select: {
                name: true,
              },
            },
            _count: {
              select: {
                items: true,
                returns: true,
              },
            },
          },
        }),
      ])
    : [
        {
          _count: {
            _all: 0,
          },
          _sum: {
            subtotal: 0,
          },
        },
        [],
      ];
  const totalSpent = summary._sum.subtotal ?? 0;
  const transactionCount = summary._count._all;
  const averageTransaction =
    transactionCount > 0 ? Math.round(totalSpent / transactionCount) : 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Customer
          </Link>
          <h1 className="page-title mt-4">{customer.name}</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {customer.customerCode} - Data customer aktif dari transaksi POS.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
            <User className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Nama
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
            {customer.name}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
            <MessageCircle className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            WhatsApp
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
            {customer.phone ?? "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
            <Star className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Loyalty Points
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
            {customer.loyaltyPoints}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
            <CalendarDays className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Terdaftar
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
            {formatDateTime(customer.createdAt)}
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Info Customer
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">
                  Alamat
                </p>
                <p className="mt-1 flex items-start gap-2 text-slate-800 dark:text-slate-200">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {customer.address ?? "-"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">
                  Catatan
                </p>
                <p className="mt-1 text-slate-800 dark:text-slate-200">
                  {customer.notes ?? "-"}
                </p>
              </div>
            </div>
          </div>

          {canViewHistory ? (
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Total Transaksi
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {transactionCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Total Belanja
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {rupiah(totalSpent)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Rata-rata Transaksi
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {rupiah(averageTransaction)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
              Histori transaksi dan total belanja hanya tersedia untuk owner
              dan developer.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                Histori Pembelian
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Read-only dari transaksi yang sudah tersimpan.
              </p>
            </div>
            <History className="h-5 w-5 text-slate-400" />
          </div>

          {!canViewHistory ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              <ReceiptText className="mb-4 h-12 w-12 text-slate-400" />
              Histori tidak ditampilkan untuk role kasir.
            </div>
          ) : sales.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              <ReceiptText className="mb-4 h-12 w-12 text-slate-400" />
              Belum ada transaksi untuk customer ini.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-4">Invoice</th>
                      <th className="px-5 py-4">Tanggal</th>
                      <th className="px-5 py-4">Kasir</th>
                      <th className="px-5 py-4">Payment</th>
                      <th className="px-5 py-4 text-right">Item</th>
                      <th className="px-5 py-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="text-sm">
                        <td className="px-5 py-4">
                          <Link
                            href={`/invoices/${sale.id}`}
                            className="font-bold text-teal-700 hover:text-teal-600 dark:text-teal-300"
                          >
                            {sale.invoiceNumber}
                          </Link>
                          {sale._count.returns > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                              Ada retur
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          {sale.cashier.name}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod}
                        </td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                          {sale._count.items}
                        </td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-950 dark:text-white">
                          {rupiah(sale.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
                {sales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/invoices/${sale.id}`}
                    className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950 dark:text-white">
                          {sale.invoiceNumber}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateTime(sale.createdAt)} - {sale.cashier.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {sale.paymentMethod} - {sale._count.items} item
                        </p>
                      </div>
                      <p className="shrink-0 font-bold tabular-nums text-slate-950 dark:text-white">
                        {rupiah(sale.subtotal)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
