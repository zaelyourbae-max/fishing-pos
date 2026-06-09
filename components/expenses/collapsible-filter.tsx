"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

/**
 * Bungkus bar filter agar bisa dilipat di mobile (default tertutup) untuk
 * menghemat ruang vertikal. Di layar `sm` ke atas filter selalu tampil penuh
 * dan tombol toggle disembunyikan.
 */
export default function CollapsibleFilter({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-sm font-bold text-slate-700 transition active:scale-[0.99] dark:text-slate-200 sm:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "mt-4 block" : "hidden"} space-y-4 sm:mt-0 sm:block`}>
        {children}
      </div>
    </div>
  );
}
