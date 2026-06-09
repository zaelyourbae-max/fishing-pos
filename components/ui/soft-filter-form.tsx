"use client";

import { ChevronDown, Filter } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

/**
 * Form filter yang menerapkan perubahan TANPA reload halaman penuh & tanpa
 * melompat ke atas — memakai navigasi halus (router.replace scroll:false).
 *
 * - Submit (tombol Filter / tekan Enter) → terapkan halus.
 * - Ganti <select> → langsung diterapkan otomatis (auto-apply).
 * - Validasi child (mis. tanggal) yang memanggil event.preventDefault() tetap
 *   dihormati: jika default sudah dicegah, navigasi dibatalkan.
 *
 * Semua field cukup punya atribut `name` seperti pada form GET biasa.
 *
 * Bila `collapsibleLabel` diisi, isi form bisa dilipat di layar HP/tablet
 * (default tertutup) dan selalu tampil di layar besar (lg ke atas).
 */
export default function SoftFilterForm({
  className,
  children,
  resetParams = ["page"],
  collapsibleLabel,
}: {
  className?: string;
  children: ReactNode;
  resetParams?: string[];
  collapsibleLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function navigate(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      const v = typeof value === "string" ? value.trim() : "";
      if (v) {
        params.set(key, v);
      }
    }

    for (const key of resetParams) {
      params.delete(key);
    }

    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <form
      className={className}
      onSubmit={(event) => {
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        navigate(event.currentTarget);
      }}
      onChange={(event) => {
        if ((event.target as HTMLElement).tagName === "SELECT") {
          navigate(event.currentTarget);
        }
      }}
    >
      {collapsibleLabel ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 lg:hidden"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Filter className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              {collapsibleLabel}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
          <div className={`${open ? "mt-3" : "hidden"} lg:mt-0 lg:block`}>
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </form>
  );
}
