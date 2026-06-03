"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

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
 */
export default function SoftFilterForm({
  className,
  children,
  resetParams = ["page"],
}: {
  className?: string;
  children: ReactNode;
  resetParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

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
      {children}
    </form>
  );
}
