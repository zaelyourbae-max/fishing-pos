import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  MessageCircle,
  Star,
  User,
} from "lucide-react";

import { isOwnerRole } from "@/lib/permissions";
import { formatDateID } from "@/lib/date-format";
import { requireCustomersPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { loyaltyProgressFromValidCount } from "@/lib/loyalty";
import { getLoyaltyConfig } from "@/lib/loyalty-settings";
import CollapsibleInfoCards from "@/components/customers/collapsible-info-cards";
import PurchaseHistory from "@/components/customers/purchase-history";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// Versi singkat untuk layar HP agar angka besar tetap muat 1 baris.
// Contoh: 40.000.000 -> "Rp 40 jt", 2.500.000 -> "Rp 2,5 jt", 950.000 -> "Rp 950 rb".
function rupiahSingkat(amount: number) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const ringkas = (nilai: number, satuan: string) => {
    const dibulatkan = Math.round(nilai * 10) / 10;
    const teks = Number.isInteger(dibulatkan)
      ? dibulatkan.toString()
      : dibulatkan.toFixed(1).replace(".", ",");
    return `${sign}Rp ${teks} ${satuan}`;
  };
  if (abs >= 1_000_000_000) return ringkas(abs / 1_000_000_000, "M");
  if (abs >= 1_000_000) return ringkas(abs / 1_000_000, "jt");
  if (abs >= 1_000) return ringkas(abs / 1_000, "rb");
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const session = await requireCustomersPage();
  const canViewBusinessSummary = isOwnerRole(session.role);
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
      // Rekap transaksi arsip yang sudah dihapus permanen — agar total belanja
      // & jumlah transaksi (penggerak status loyalty) tetap valid.
      archivedSalesCount: true,
      archivedSalesSpend: true,
    },
  });

  if (!customer) {
    notFound();
  }

  const finalCustomerSaleWhere = {
    customerId: customer.id,
    ...FINAL_SALE_STATUS_WHERE,
  };
  const [summary, sales, loyaltyBenefitSales] = await Promise.all([
    prisma.sale.aggregate({
      where: finalCustomerSaleWhere,
      _count: {
        _all: true,
      },
      _sum: {
        subtotal: true,
      },
    }),
    prisma.sale.findMany({
      where: finalCustomerSaleWhere,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        subtotal: true,
        paymentMethod: true,
        transactionStatus: true,
        paymentStatus: true,
        loyaltyApplied: true,
        loyaltyMilestone: true,
        loyaltyDiscountAmount: true,
        loyaltyBenefitNote: true,
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
        items: {
          select: {
            qty: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
          orderBy: {
            id: "asc",
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
    prisma.sale.findMany({
      where: {
        ...finalCustomerSaleWhere,
        loyaltyApplied: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        loyaltyMilestone: true,
        loyaltyDiscountAmount: true,
      },
    }),
  ]);
  // Tambah rekap arsip yang sudah dihapus permanen agar angka tetap valid.
  const totalSpent = (summary._sum.subtotal ?? 0) + customer.archivedSalesSpend;
  const transactionCount = summary._count._all + customer.archivedSalesCount;
  const averageTransaction =
    transactionCount > 0 ? Math.round(totalSpent / transactionCount) : 0;
  const loyaltyConfig = await getLoyaltyConfig();
  const loyaltyProgress = loyaltyProgressFromValidCount(
    transactionCount,
    loyaltyConfig.interval,
  );

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
        </div>
      </div>

      <CollapsibleInfoCards
        summary={
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                Info Customer
              </p>
            </div>
          </div>
        }
      >
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <div className="flex items-center gap-2 sm:block">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200 sm:h-12 sm:w-12">
              <User className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
              Nama
            </p>
          </div>
          <p className="mt-2 break-words text-base font-extrabold text-slate-950 dark:text-white sm:mt-1 sm:text-xl sm:font-bold">
            {customer.name}
          </p>
          <p className="mt-1 break-all text-xs font-medium text-slate-400 dark:text-slate-500">
            {customer.customerCode}
          </p>
          <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:hidden">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Alamat
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-800 dark:text-slate-200">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              {customer.address ?? "-"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <div className="flex items-center gap-2 sm:block">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200 sm:h-12 sm:w-12">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
              WhatsApp
            </p>
          </div>
          <p className="mt-2 break-words text-base font-extrabold text-slate-950 dark:text-white sm:mt-1 sm:text-xl sm:font-bold">
            {customer.phone ?? "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <div className="flex items-center gap-2 sm:block">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200 sm:h-12 sm:w-12">
              <Star className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
              Loyalty Points
            </p>
          </div>
          <p className="mt-2 text-base font-extrabold text-slate-950 dark:text-white sm:mt-1 sm:text-xl sm:font-bold">
            {transactionCount}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs">
            Berdasarkan transaksi valid SUCCESS + PAID.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <div className="flex items-center gap-2 sm:block">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200 sm:h-12 sm:w-12">
              <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-sm">
              Terdaftar
            </p>
          </div>
          <p className="mt-2 break-words text-sm font-extrabold text-slate-950 dark:text-white sm:mt-1 sm:text-xl sm:font-bold">
            {formatDateID(customer.createdAt)}
          </p>
        </div>
      </section>
      </CollapsibleInfoCards>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <div className="space-y-5">
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:block">
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

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
              <div
                className={`grid divide-x divide-slate-100 dark:divide-slate-800 ${
                  canViewBusinessSummary ? "grid-cols-3" : "grid-cols-1"
                }`}
              >
                <div className="pr-2 sm:pr-3">
                  <p className="flex min-h-8 items-start text-xs font-semibold text-slate-500 dark:text-slate-400 sm:min-h-0 sm:text-sm">
                    Total Transaksi Valid
                  </p>
                  <p className="mt-1 text-base font-bold tabular-nums text-slate-950 dark:text-white sm:text-2xl">
                    {transactionCount.toLocaleString("id-ID")}
                  </p>
                </div>
                {canViewBusinessSummary ? (
                  <>
                    <div className="px-2 sm:px-3">
                      <p className="flex min-h-8 items-start text-xs font-semibold text-slate-500 dark:text-slate-400 sm:min-h-0 sm:text-sm">
                        Total Belanja
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-950 dark:text-white sm:text-2xl">
                        <span className="sm:hidden">
                          {rupiahSingkat(totalSpent)}
                        </span>
                        <span className="hidden sm:inline">
                          {rupiah(totalSpent)}
                        </span>
                      </p>
                    </div>
                    <div className="pl-2 sm:pl-3">
                      <p className="flex min-h-8 items-start text-xs font-semibold text-slate-500 dark:text-slate-400 sm:min-h-0 sm:text-sm">
                        Rata-rata Transaksi
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-950 dark:text-white sm:text-2xl">
                        <span className="sm:hidden">
                          {rupiahSingkat(averageTransaction)}
                        </span>
                        <span className="hidden sm:inline">
                          {rupiah(averageTransaction)}
                        </span>
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:text-xs">
                Hanya menghitung transaksi yang selesai dan sudah dibayar lunas.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                Progress Loyalty
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-50">
                {transactionCount}/{loyaltyProgress.nextMilestone}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-100">
                Sisa {loyaltyProgress.remainingToNext} transaksi valid.
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-100">
                Milestone berikutnya: transaksi ke-{loyaltyProgress.nextMilestone}.
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-100">
                S&K benefit: minimal pembelian {rupiah(loyaltyConfig.minPurchase)}.
              </p>
            </div>
            {loyaltyBenefitSales.length > 0 ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm dark:border-teal-500/20 dark:bg-teal-500/10">
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-100">
                  Histori Benefit Loyalty
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  {loyaltyBenefitSales.slice(0, 5).map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/invoices/${sale.id}`}
                      className="block rounded-xl bg-white/70 px-3 py-2 font-semibold text-teal-800 hover:bg-white dark:bg-slate-950/40 dark:text-teal-100"
                    >
                      {sale.invoiceNumber}
                      {sale.loyaltyMilestone
                        ? ` - ke-${sale.loyaltyMilestone}`
                        : ""}
                      {sale.loyaltyDiscountAmount > 0
                        ? ` - ${rupiah(sale.loyaltyDiscountAmount)}`
                        : ""}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
        </div>

        <PurchaseHistory
          sales={sales}
          canViewBusinessSummary={canViewBusinessSummary}
        />
      </section>
    </div>
  );
}
