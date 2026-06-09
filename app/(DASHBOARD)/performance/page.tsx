import Link from "next/link";
import { Calendar, CalendarDays } from "lucide-react";

import OwnerPerformanceView from "@/components/performance/owner-performance-view";
import SelfPerformanceView from "@/components/performance/self-performance-view";
import { isOwnerRole } from "@/lib/permissions";
import { requireProtectedPage } from "@/lib/page-guards";
import {
  bulanIniRange,
  getAllCashierPerformance,
  getSelfPerformance,
  hariIniRange,
} from "@/lib/performance";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{ periode?: string }>;

function PeriodTabs({ active }: { active: "hari" | "bulan" }) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition duration-200";
  const on = "bg-primary text-white shadow-sm";
  const off =
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950/70">
      <Link
        href="/performance?periode=bulan"
        className={`${base} ${active === "bulan" ? on : off}`}
      >
        <CalendarDays className="h-4 w-4" /> Bulan ini
      </Link>
      <Link
        href="/performance?periode=hari"
        className={`${base} ${active === "hari" ? on : off}`}
      >
        <Calendar className="h-4 w-4" /> Hari ini
      </Link>
    </div>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireProtectedPage();
  const { periode } = await searchParams;

  if (isOwnerRole(session.role)) {
    const useToday = periode === "hari";
    const range = useToday ? hariIniRange() : bulanIniRange();
    const rows = await getAllCashierPerformance(range);

    return (
      <div className="mx-auto w-full max-w-[1480px] space-y-4 sm:space-y-5">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.045)] dark:border-white/8 dark:bg-slate-900 sm:p-5 xl:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
                Performa Kasir
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Pantau kinerja semua kasir · {range.label}
              </p>
            </div>
            <PeriodTabs active={useToday ? "hari" : "bulan"} />
          </div>
        </section>

        <OwnerPerformanceView rows={rows} />
      </div>
    );
  }

  // Kasir: hanya data dirinya sendiri (this month vs last month).
  const [self, currentUser] = await Promise.all([
    getSelfPerformance(session.sub),
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { name: true },
    }),
  ]);
  const name = currentUser?.name ?? "Kasir";

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 sm:space-y-5">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.045)] dark:border-white/8 dark:bg-slate-900 sm:p-5 xl:p-6">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
          Performa Saya
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Halo {name}, ini perkembanganmu bulan ini dibanding bulan lalu.
        </p>
      </section>

      <SelfPerformanceView name={name} self={self} />
    </div>
  );
}
