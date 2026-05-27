import Link from "next/link";
import { ArrowUpRight, PackageSearch, PackageX } from "lucide-react";

export type ProductAnalyticsCardItem = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  daysSinceLastSold: number;
  detailHref: string;
};

type ProductAnalyticsCardGroup = {
  title: string;
  helper: string;
  href: string;
  total: number;
  items: ProductAnalyticsCardItem[];
  tone: "amber" | "rose";
};

type ProductAnalyticsCardProps = {
  slowMoving: ProductAnalyticsCardGroup;
  deadStock: ProductAnalyticsCardGroup;
};

const toneClass = {
  amber: {
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    count: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
    link: "text-amber-700 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-500/10",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
    count: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
    link: "text-rose-700 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-500/10",
  },
};

function ProductAnalyticsGroup({
  group,
}: {
  group: ProductAnalyticsCardGroup;
}) {
  const Icon = group.tone === "rose" ? PackageX : PackageSearch;
  const style = toneClass[group.tone];

  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-snug text-slate-950 dark:text-white">
              {group.title}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
              {group.helper}
            </span>
          </span>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${style.count}`}
        >
          {group.total}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {group.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
            Tidak ada produk pada kategori ini.
          </div>
        ) : null}

        {group.items.map((item) => (
          <Link
            key={item.id}
            href={item.detailHref}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 transition duration-200 hover:border-teal-100 hover:bg-teal-50/40 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-teal-500/10"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-950 dark:text-white">
                {item.name}
              </span>
              <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="break-all">{item.sku ?? "-"}</span>
                <span className="whitespace-nowrap">Stok {item.stock}</span>
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
              {item.daysSinceLastSold} hari
            </span>
          </Link>
        ))}
      </div>

      <Link
        href={group.href}
        className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold transition duration-200 hover:-translate-y-0.5 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-950 ${style.link}`}
      >
        Lihat Semua
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function ProductAnalyticsCard({
  slowMoving,
  deadStock,
}: ProductAnalyticsCardProps) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white">
            Analitik Produk
          </h2>
          <p className="mt-1 text-sm leading-snug text-slate-500 dark:text-slate-400">
            Preview produk yang perlu dievaluasi dari pergerakan penjualan.
          </p>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
        <ProductAnalyticsGroup group={slowMoving} />
        <ProductAnalyticsGroup group={deadStock} />
      </div>
    </section>
  );
}
