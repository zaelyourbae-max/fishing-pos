"use client";

import { Menu, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

/**
 * Pembungkus tombol aksi produk untuk tampilan kartu (HP & tablet).
 *
 * Di HP: tombol disembunyikan di balik ikon garis-tiga (laci yang membuka
 * melebar di dalam kartu). Ikon pemicunya mengambang di pojok kanan-ATAS kartu
 * (absolute terhadap .mobile-card-surface yang ber-posisi relative), sementara
 * HARGA dipindah turun ke baris "Aksi Produk". Di tablet ke atas (sm+): tombol
 * langsung tampil, ikon pemicu & harga-bawah disembunyikan (harga tetap di atas).
 */
export default function ProductActionsMenu({
  children,
  price,
  unit,
  margin,
  hpp,
  hasTopStrip = false,
  compactFigures = false,
}: {
  children: React.ReactNode;
  price: string;
  unit: string;
  /** Teks margin (mis. "Rp 99.000 (99%)"). Null bila pengguna tak boleh lihat HPP. */
  margin?: string | null;
  /** Teks HPP (mis. "Rp 5.000" / "belum lengkap"). Null bila tak boleh lihat HPP. */
  hpp?: string | null;
  /** True bila kartu punya strip perputaran di tepi atas; pemicu laci digeser
      turun supaya tidak menumpuk dengan strip. */
  hasTopStrip?: boolean;
  /** True bila angka mencapai jutaan: font HPP/Margin/Harga dikecilkan supaya
      tetap muat satu baris & sebaris dengan kartu lain (tak pindah baris). */
  compactFigures?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:mt-3 sm:pt-3">
      {/* Pemicu laci: pojok kanan-atas kartu, hanya HP. Saat ada strip atas,
          digeser turun (top-10) agar tidak menumpuk dengannya. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "Tutup aksi produk" : "Buka aksi produk"}
        className={`absolute right-2.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:text-teal-200 sm:hidden ${
          hasTopStrip ? "top-10" : "top-2.5"
        }`}
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      <div className="flex items-center justify-between gap-2">
        {/* Label "Aksi Produk": di HP digantikan oleh Margin (jika ada), jadi
            hanya tampil di tablet+. Tetap tampil di HP bila margin tak tersedia. */}
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
            margin || hpp ? "hidden sm:block" : ""
          }`}
        >
          Aksi Produk
        </p>
        {/* HPP (kecil) di atas Margin, gantikan tulisan "Aksi Produk", hanya HP. */}
        {margin || hpp ? (
          <div className="min-w-0 sm:hidden">
            {hpp ? (
              <p
                className={`font-semibold tabular-nums text-slate-500 dark:text-slate-400 ${
                  compactFigures ? "text-[10px]" : "text-[11px]"
                }`}
              >
                HPP {hpp}
              </p>
            ) : null}
            {margin ? (
              <p
                className={`font-bold tabular-nums text-emerald-700 dark:text-emerald-300 ${
                  compactFigures ? "text-[11px]" : "text-sm"
                }`}
              >
                Margin {margin}
              </p>
            ) : null}
          </div>
        ) : null}
        {/* Harga pindah ke sini (tempat laci dulu), hanya HP. Saat angka jutaan,
            font dikecilkan (compactFigures) supaya tetap satu baris bersama
            HPP/Margin, tidak pindah baris. */}
        <span
          className={`shrink-0 whitespace-nowrap text-right font-extrabold tabular-nums text-slate-950 dark:text-white sm:hidden ${
            compactFigures ? "text-xs" : "text-[15px]"
          }`}
        >
          {price}
          <span
            className={`ml-1 font-semibold text-slate-500 dark:text-slate-400 ${
              compactFigures ? "text-[10px]" : "text-xs"
            }`}
          >
            / {unit}
          </span>
        </span>
      </div>

      <div
        className={`${
          open ? "mt-2 grid" : "hidden"
        } grid-cols-2 gap-1.5 sm:mt-2 sm:grid sm:grid-cols-3 sm:gap-2`}
      >
        {children}
      </div>
    </div>
  );
}
