"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import KpiActionCard, {
  type KpiActionCardProps,
} from "@/components/dashboard/kpi-action-card";

type DashboardKpiCardsProps = {
  /** Kartu yang selalu tampil. */
  primary: KpiActionCardProps[];
  /** Kartu yang dilipat di mobile — disembunyikan sampai tombol "Lihat lainnya" ditekan. */
  secondary: KpiActionCardProps[];
};

function KpiGrid({
  cards,
  className,
  size = "compact",
}: {
  cards: KpiActionCardProps[];
  className: string;
  size?: KpiActionCardProps["size"];
}) {
  return (
    <div className={`grid min-w-0 ${className}`}>
      {cards.map((card, index) => (
        <div
          key={card.title}
          className={`min-w-0 ${
            index === cards.length - 1 && cards.length % 2 === 1
              ? "col-span-2 lg:col-span-1"
              : ""
          }`}
        >
          <KpiActionCard {...card} size={size} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardKpiCards({
  primary,
  secondary,
}: DashboardKpiCardsProps) {
  const [showAll, setShowAll] = useState(false);
  const mobileCards = showAll ? [...primary, ...secondary] : primary;
  const allCards = [...primary, ...secondary];

  return (
    <>
      {/* Mobile: kartu sekunder dilipat di balik tombol "Lihat lainnya". */}
      <div className="space-y-3 md:hidden">
        <KpiGrid cards={mobileCards} className="grid-cols-2 gap-3 sm:gap-4" />

        {secondary.length ? (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-extrabold text-teal-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950 dark:text-teal-300 dark:hover:bg-slate-900"
          >
            {showAll
              ? "Sembunyikan sebagian"
              : `Lihat ${secondary.length} angka lainnya`}
            <ChevronDown
              className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>

      {/* Desktop: semua kartu langsung tampil (mengikuti pola laporan owner). */}
      <div className="hidden md:block">
        <KpiGrid cards={allCards} className="grid-cols-3 gap-4" size="regular" />
      </div>
    </>
  );
}
