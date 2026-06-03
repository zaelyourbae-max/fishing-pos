"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalAlign = "center" | "bottom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Kelas untuk kotak panel (ukuran, rounded, warna latar, dll). */
  panelClassName?: string;
  /** Posisi panel: tengah layar, atau menempel bawah di mobile (bottom-sheet). */
  align?: ModalAlign;
  /** Klik area gelap di luar panel untuk menutup. Default true. */
  closeOnBackdrop?: boolean;
  /** Tekan Escape untuk menutup. Default true. */
  closeOnEscape?: boolean;
  /** Tambahan kelas untuk lapisan gelap (backdrop). */
  backdropClassName?: string;
};

const DURATION_MS = 200;

/**
 * Cetakan pop-up bersama — buka & tutup sama-sama HALUS.
 *
 * Saat dibuka: lapisan gelap memudar masuk, panel memudar + naik sedikit + membesar.
 * Saat ditutup: animasi mundur dulu, BARU panel dilepas dari layar (tidak hilang
 * mendadak). Semua modul memakai ini supaya seragam.
 */
export default function Modal({
  open,
  onClose,
  children,
  panelClassName = "",
  align = "center",
  closeOnBackdrop = true,
  closeOnEscape = true,
  backdropClassName = "",
}: ModalProps) {
  // `mounted` = masih ada di DOM (termasuk saat animasi tutup berjalan).
  // `show`    = sedang dalam keadaan tampil (memicu transisi masuk/keluar).
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Tunggu 1 frame agar transisi "masuk" benar-benar teranimasi.
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }

    setShow(false);
    const timer = setTimeout(() => setMounted(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Kunci scroll latar selama pop-up terbuka.
  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const alignClass =
    align === "bottom" ? "items-end sm:items-center" : "items-center";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center p-3 sm:p-6 ${alignClass} bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200 ${
        show ? "opacity-100" : "opacity-0"
      } ${backdropClassName}`}
      onClick={closeOnBackdrop ? onClose : undefined}
      aria-hidden={!show}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={`transition-all duration-200 ease-out ${
          show
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-95"
        } ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
