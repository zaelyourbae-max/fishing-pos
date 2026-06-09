export type MetricBar = {
  label: string;
  /** Lebar isian 0-100. */
  percent: number;
  /** Teks nilai di kanan label (mis. "Rp 1.2jt" atau "85%"). */
  value: string;
  /** Catatan kecil di bawah bar (opsional), mis. "naik 12% dari bulan lalu". */
  caption?: string;
  /** Warna isian. Default mengikuti palet (primary). */
  tone?: "primary" | "emerald" | "rose";
};

const FILL_TONE: Record<NonNullable<MetricBar["tone"]>, string> = {
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
};

export default function MetricBars({ items }: { items: MetricBar[] }) {
  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const width = Math.max(0, Math.min(100, item.percent));

        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950 dark:text-white">
                {item.value}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  FILL_TONE[item.tone ?? "primary"]
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            {item.caption ? (
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {item.caption}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
