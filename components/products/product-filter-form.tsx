"use client";

import { Filter } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import LiveSearchInput from "@/components/search/live-search-input";

/**
 * Form filter produk versi client: memilih kategori / menekan "Filter" memakai
 * navigasi halus (router.replace scroll:false) — tidak reload halaman penuh dan
 * tidak melompat ke atas. Pencarian (LiveSearchInput) sudah halus dari sananya.
 */
export default function ProductFilterForm({
  initialQ,
  initialCategory,
  categoryOptions,
}: {
  initialQ: string;
  initialCategory: string;
  categoryOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(initialCategory);
  const [, startTransition] = useTransition();

  function applyCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("category", value);
    } else {
      params.delete("category");
    }

    params.delete("page");
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        applyCategory(category);
      }}
      className="grid grid-cols-2 gap-2.5 border-b border-slate-200 p-3 md:grid-cols-[1fr_270px_auto] dark:border-slate-800 sm:gap-3 sm:p-4"
    >
      <LiveSearchInput
        initialValue={initialQ}
        placeholder="Cari nama produk, SKU, barcode..."
        className="col-span-2 md:col-span-1"
      />
      <select
        value={category}
        onChange={(event) => {
          setCategory(event.target.value);
          applyCategory(event.target.value);
        }}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:rounded-2xl sm:px-4"
      >
        <option value="">Laci</option>
        {categoryOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:active:bg-slate-900 sm:h-12 sm:rounded-2xl sm:px-5"
        type="submit"
      >
        <Filter className="h-4 w-4" />
        Filter
      </button>
    </form>
  );
}
