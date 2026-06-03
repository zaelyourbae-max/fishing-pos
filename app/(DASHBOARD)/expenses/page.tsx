import Link from "next/link";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { formatDateID } from "@/lib/date-format";
import { rupiah } from "@/lib/reports";
import ExpenseListClient from "@/components/expenses/expense-list-client";
import DatePicker from "@/components/ui/date-picker";
import { Receipt, TrendingDown, CalendarDays, Tag } from "lucide-react";

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    category?: string;
  }>;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function toInput(date: Date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const weekStart = startOfDay(new Date(today));
  weekStart.setDate(today.getDate() - 6);
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const from = startOfDay(parseDate(params.from, monthStart));
  const to = endOfDay(parseDate(params.to, today));
  const categoryFilter = params.category?.trim() || undefined;

  // Toggle periode cepat: Hari Ini / 7 Hari / Bulan Ini / Tahun Ini.
  const currentFrom = params.from ?? toInput(monthStart);
  const currentTo = params.to ?? toInput(today);
  const periodPresets = [
    { key: "today", label: "Hari Ini", from: toInput(today), to: toInput(today) },
    { key: "week", label: "7 Hari", from: toInput(weekStart), to: toInput(today) },
    { key: "month", label: "Bulan Ini", from: toInput(monthStart), to: toInput(today) },
    { key: "year", label: "Tahun Ini", from: toInput(yearStart), to: toInput(today) },
  ];
  const periodHref = (preset: { from: string; to: string }) => {
    const query = new URLSearchParams();
    query.set("from", preset.from);
    query.set("to", preset.to);
    if (categoryFilter) query.set("category", categoryFilter);
    return `/expenses?${query.toString()}`;
  };

  const where = {
    date: { gte: from, lte: to },
    ...(categoryFilter ? { category: { contains: categoryFilter, mode: "insensitive" as const } } : {}),
  };

  const [expenses, aggregate, categories, todayAggregate, topCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: { createdBy: { select: { name: true } } },
      take: 200,
    }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      orderBy: { _count: { category: "desc" } },
      take: 50,
    }),
    prisma.expense.aggregate({
      where: { date: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    }),
  ]);

  const rows = expenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    category: e.category,
    amount: e.amount,
    description: e.description,
    date: formatDateID(e.date),
    createdByName: e.createdBy.name,
  }));

  const totalAmount = aggregate._sum.amount ?? 0;
  const totalCount = aggregate._count._all;
  const avgAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
  const todayAmount = todayAggregate._sum.amount ?? 0;
  const todayCount = todayAggregate._count._all;
  const topCategoryName = topCategory[0]?.category ?? null;

  const summaryCards = [
    {
      title: "Total Periode",
      value: rupiah(totalAmount),
      helper: `${totalCount} catatan`,
      icon: TrendingDown,
    },
    {
      title: "Hari Ini",
      value: rupiah(todayAmount),
      helper: `${todayCount} pengeluaran`,
      icon: CalendarDays,
    },
    {
      title: "Rata-rata / Catatan",
      value: rupiah(avgAmount),
      helper: "Per entri pengeluaran",
      icon: Receipt,
    },
    {
      title: "Kategori Terbesar",
      value: topCategoryName ?? "-",
      helper: topCategoryName ? rupiah(topCategory[0]._sum.amount ?? 0) : "Belum ada data",
      icon: Tag,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      {/* Header */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.045)] dark:border-white/8 dark:bg-slate-900 xl:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
              Pengeluaran
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Catatan biaya operasional toko
            </p>
          </div>
        </div>

        {/* Toggle periode cepat */}
        <div className="mt-4 flex flex-wrap gap-2">
          {periodPresets.map((preset) => {
            const active = currentFrom === preset.from && currentTo === preset.to;
            return (
              <Link
                key={preset.key}
                href={periodHref(preset)}
                className={
                  active
                    ? "inline-flex h-9 items-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm transition active:scale-95"
                    : "inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500/60"
                }
              >
                {preset.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-8px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/70"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <span className="mt-1 block truncate text-base font-extrabold tabular-nums text-slate-950 dark:text-white xl:text-lg">
                  {card.value}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
                  {card.helper}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Filter + Daftar */}
      <section className="rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_36px_-12px_rgba(15,23,42,0.12),0_4px_10px_-6px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-[0_14px_36px_-12px_rgba(0,0,0,0.5)]">
        {/* Filter bar */}
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dari</label>
              <DatePicker
                name="from"
                defaultValue={params.from ?? toInput(monthStart)}
                max={toInput(today)}
                className="w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sampai</label>
              <DatePicker
                name="to"
                defaultValue={params.to ?? toInput(today)}
                max={toInput(today)}
                className="w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kategori</label>
              <select
                name="category"
                defaultValue={params.category ?? ""}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-teal-500/20"
              >
                <option value="">Semua kategori</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Terapkan
            </button>
          </form>
        </div>

        {/* List + tombol tambah */}
        <div className="p-5">
          <ExpenseListClient
            expenses={rows}
            totalAmount={totalAmount}
            totalCount={totalCount}
          />
        </div>
      </section>
    </div>
  );
}
