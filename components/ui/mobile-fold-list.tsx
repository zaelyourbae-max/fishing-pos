"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

type MobileFoldListProps = {
  children: ReactNode;
  /** Jumlah item yang selalu tampil di HP (sisanya dilipat). */
  visible?: number;
  /** Label tombol buka, mis. "Lihat 2 lainnya". Default dihitung otomatis. */
  moreLabel?: string;
};

/**
 * Pembungkus daftar yang HANYA melipat di HP: tampil `visible` item, sisanya
 * disembunyikan di balik tombol buka/tutup. Di layar besar (lg+) semua item
 * selalu tampil & tombolnya disembunyikan — ruang layar besar sudah cukup luas.
 */
export default function MobileFoldList({
  children,
  visible = 3,
  moreLabel,
}: MobileFoldListProps) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const hiddenCount = items.length - visible;

  // Tidak ada yang perlu dilipat — tampilkan apa adanya.
  if (hiddenCount <= 0) {
    return <>{children}</>;
  }

  return (
    <>
      {items.map((child, index) => {
        if (index < visible || !isValidElement(child)) {
          return child;
        }

        // Item ke-(visible+1) dst: di HP disembunyikan kecuali dibuka.
        // Pakai `max-lg:hidden` (bukan `hidden lg:block`) supaya di lg+ elemen
        // tetap memakai display aslinya (flex/grid), tidak dipaksa jadi block.
        const element = child as ReactElement<{ className?: string }>;
        const extraClass = open ? "" : "max-lg:hidden";
        const existing = element.props.className ?? "";

        return cloneElement(element, {
          className: `${existing} ${extraClass}`.trim(),
        });
      })}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 lg:hidden"
      >
        {open ? "Sembunyikan" : (moreLabel ?? `Lihat ${hiddenCount} lainnya`)}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
    </>
  );
}
