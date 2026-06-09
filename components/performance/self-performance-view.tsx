import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";

import MetricBars, { type MetricBar } from "@/components/performance/metric-bars";
import PerformanceRadar from "@/components/performance/performance-radar";
import {
  SELF_AXES,
  selfRadarSeries,
  type SelfPerformance,
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

function deltaCaption(cur: number, prev: number) {
  if (prev <= 0) {
    return cur > 0 ? "Belum ada pembanding bulan lalu" : "Belum ada data";
  }

  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct > 0) return `▲ naik ${pct}% dari bulan lalu`;
  if (pct < 0) return `▼ turun ${Math.abs(pct)}% dari bulan lalu`;

  return "Sama dengan bulan lalu";
}

function toneFor(cur: number, prev: number): MetricBar["tone"] {
  if (prev <= 0 || cur === prev) return "primary";

  return cur > prev ? "emerald" : "rose";
}

export default function SelfPerformanceView({
  name,
  self,
}: {
  name: string;
  self: SelfPerformance;
}) {
  const { current, previous } = self;
  const { currentSeries, previousSeries } = selfRadarSeries(self);

  const metricRows: { label: string; cur: number; prev: number; fmt: (n: number) => string }[] = [
    { label: "Omzet", cur: current.omzet, prev: previous.omzet, fmt: rupiah },
    { label: "Transaksi", cur: current.txCount, prev: previous.txCount, fmt: (n) => String(n) },
    { label: "Rata-rata belanja", cur: current.avgPerTx, prev: previous.avgPerTx, fmt: rupiah },
    { label: "Rata-rata barang", cur: current.avgItems, prev: previous.avgItems, fmt: oneDecimal },
  ];

  const bars: MetricBar[] = metricRows.map((row) => {
    const max = Math.max(row.cur, row.prev);

    return {
      label: row.label,
      percent: max > 0 ? (row.cur / max) * 100 : 0,
      value: row.fmt(row.cur),
      caption: deltaCaption(row.cur, row.prev),
      tone: toneFor(row.cur, row.prev),
    };
  });

  const score = self.overallScore;
  const up = score !== null && score > 100;
  const down = score !== null && score < 100;
  const ScoreIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const scoreColor = up
    ? "text-emerald-600 dark:text-emerald-400"
    : down
      ? "text-rose-600 dark:text-rose-400"
      : "text-primary";

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">Skor kemajuan kamu</p>
        </div>

        {self.hasBaseline && score !== null ? (
          <>
            <div className={`mt-2 flex items-end gap-2 ${scoreColor}`}>
              <span className="text-5xl font-extrabold leading-none tracking-tight">
                {score}
                <span className="text-2xl">%</span>
              </span>
              <ScoreIcon className="mb-1 h-7 w-7" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {up
                ? "Mantap! Kamu lebih baik dari bulan lalu. Pertahankan 🔥"
                : down
                  ? "Sedikit menurun dari bulan lalu. Ayo kejar lagi!"
                  : "Stabil seperti bulan lalu. Coba dorong lebih tinggi!"}{" "}
              <span className="text-xs">(100% = setara bulan lalu)</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ini periode pertamamu — belum ada bulan lalu untuk dibandingkan.
            Terus kumpulkan transaksi, bulan depan skor kemajuanmu mulai terlihat. 💪
          </p>
        )}
      </section>

      <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
            Bulan ini vs bulan lalu
          </h2>
          <div className="mt-3 flex justify-center">
            <PerformanceRadar
              axes={SELF_AXES}
              series={[
                {
                  values: previousSeries,
                  className: "fill-none stroke-slate-300 dark:stroke-slate-600",
                  dotClassName: "fill-slate-300 stroke-none dark:fill-slate-600",
                  label: "Bulan lalu",
                },
                {
                  values: currentSeries,
                  className: "fill-primary/20 stroke-primary",
                  dotClassName: "fill-primary stroke-none",
                  label: "Bulan ini",
                },
              ]}
              className="h-auto w-full max-w-[300px]"
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Bulan ini
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />{" "}
              Bulan lalu
            </span>
          </div>
        </section>

        <section className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
            Rincian
          </h2>
          <div className="mt-4">
            <MetricBars items={bars} />
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Pembatalan bulan ini: {current.cancelCount} (bulan lalu:{" "}
            {previous.cancelCount}). Makin sedikit makin baik.
          </p>
        </section>
      </div>
    </div>
  );
}
