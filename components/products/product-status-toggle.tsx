"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Option = {
  label: string;
  value: string;
  href: string;
};

/**
 * Segmented toggle (Active / Inactive / Semua) dengan indikator yang BERGESER
 * halus saat dipilih, dan navigasi tanpa reset scroll (scroll={false}) sehingga
 * tampilan tetap di posisinya — tidak melompat ke atas.
 */
export default function ProductStatusToggle({
  options,
  active,
}: {
  options: Option[];
  active: string;
}) {
  const [current, setCurrent] = useState(active);

  // Sinkron lagi kalau server mengubah status (mis. tombol back).
  useEffect(() => {
    setCurrent(active);
  }, [active]);

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === current),
  );

  return (
    <div className="relative flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900 sm:rounded-2xl">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-lg border border-teal-200 bg-teal-50 shadow-sm ring-1 ring-teal-100 transition-transform duration-300 ease-out dark:border-teal-400/30 dark:bg-teal-400/15 dark:ring-teal-400/20 sm:rounded-xl"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
      />
      {options.map((option) => {
        const isActive = option.value === current;

        return (
          <Link
            key={option.value}
            href={option.href}
            scroll={false}
            onClick={() => setCurrent(option.value)}
            aria-current={isActive ? "page" : undefined}
            className={`relative z-10 inline-flex h-9 flex-1 items-center justify-center px-3 text-xs font-semibold transition-colors sm:h-11 sm:px-4 sm:text-sm ${
              isActive
                ? "text-teal-800 dark:text-teal-100"
                : "text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-200"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
