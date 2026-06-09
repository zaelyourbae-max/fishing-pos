import { Award, TrendingUp } from "lucide-react";

import MetricBars from "@/components/performance/metric-bars";
import PerformanceRadar from "@/components/performance/performance-radar";
import {
  RADAR_AXES,
  type CashierPerformanceRow,
} from "@/lib/performance";

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function oneDecimal(value: number) {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const RANK_LABEL = ["🥇", "🥈", "🥉"];

function CashierCard({
  row,
  rank,
}: {
  row: CashierPerformanceRow;
  rank: number;
}) {
  const bars = RADAR_AXES.map((axis, index) => ({
    label: axis,
    percent: row.axisScores[index],
    value: `${row.axisScores[index]}%`,
  }));

  const rawStats: { label: string; value: string }[] = [
    { label: "Omzet", value: rupiah(row.metrics.omzet) },
    { label: "Transaksi", value: String(row.metrics.txCount) },
    { label: "Rata-rata belanja", value: rupiah(row.metrics.avgPerTx) },
    { label: "Rata-rata barang", value: oneDecimal(row.metrics.avgItems) },
    { label: "Transaksi dibatalkan", value: String(row.metrics.cancelCount) },
  ];

  return (
    <section className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">
              {RANK_LABEL[rank] ?? `#${rank + 1}`}
            </span>
            <h2 className="min-w-0 truncate text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
              {row.name}
            </h2>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Kasir
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Skor
          </p>
          <p className="text-3xl font-extrabold leading-none tracking-tight text-primary">
            {row.overallScore}
            <span className="text-lg">%</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <PerformanceRadar
          axes={RADAR_AXES}
          series={[
            {
              values: row.axisScores,
              className: "fill-primary/20 stroke-primary",
              dotClassName: "fill-primary stroke-none",
            },
          ]}
          className="h-auto w-full max-w-[300px]"
        />
      </div>

      <div className="mt-4">
        <MetricBars items={bars} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-3">
        {rawStats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {stat.label}
            </dt>
            <dd className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function OwnerPerformanceView({
  rows,
}: {
  rows: CashierPerformanceRow[];
}) {
  const hasData = rows.some((row) => row.metrics.txCount > 0);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        Belum ada kasir terdaftar. Tambahkan kasir lewat menu User dulu.
      </div>
    );
  }

  const leaderboardBars = rows.map((row, index) => ({
    label: `${RANK_LABEL[index] ?? `#${index + 1}`} ${row.name}`,
    percent: row.overallScore,
    value: `${row.overallScore}%`,
    caption: `Omzet ${rupiah(row.metrics.omzet)} · ${row.metrics.txCount} transaksi`,
  }));

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
            Peringkat Kasir
          </h2>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Skor 100% = sehebat kasir terbaik. Tiap kasir dinilai dengan
          membandingkannya ke kasir paling unggul di tiap aspek.
        </p>
        {hasData ? (
          <div className="mt-4">
            <MetricBars items={leaderboardBars} />
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            <TrendingUp className="h-4 w-4 shrink-0" />
            Belum ada transaksi pada periode ini.
          </div>
        )}
      </section>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        {rows.map((row, index) => (
          <CashierCard key={row.id} row={row} rank={index} />
        ))}
      </div>
    </div>
  );
}
