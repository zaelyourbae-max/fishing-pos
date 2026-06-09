"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Menyusutkan isi (children) agar pas selebar wadah, sambil MEMPERTAHANKAN
 * tata letak desktop apa adanya — ibarat melihat gambar/cetakan yang
 * diperkecil utuh, bukan ditata ulang.
 *
 * - Tidak pernah memperbesar (skala maksimal 1) → di desktop tampil normal.
 * - Saat CETAK (print), penskala dimatikan langsung di DOM (sinkron, lewat
 *   event beforeprint) supaya hasil cetak tetap penuh & tidak terpotong,
 *   lalu dipulihkan setelah cetak (afterprint).
 */
export default function FitToWidth({
  designWidth = 768,
  children,
}: {
  designWidth?: number;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;

    if (!outer || !inner) {
      return;
    }

    let printing = false;

    function recalc() {
      if (printing || !outer || !inner) {
        return;
      }

      const available = outer.clientWidth;
      const next = Math.min(1, available / designWidth);
      setScale(next);
      // offsetHeight tidak terpengaruh transform, jadi aman dipakai sebagai
      // tinggi asli lalu dikalikan skala untuk menjaga alur tata letak.
      setHeight(inner.offsetHeight * next);
    }

    // Saat akan mencetak: matikan penskala SINKRON via DOM langsung
    // (bukan state React yang asinkron), agar snapshot cetak sudah penuh.
    function applyPrint() {
      if (!outer || !inner) {
        return;
      }
      printing = true;
      inner.style.transform = "none";
      inner.style.width = "auto";
      outer.style.height = "auto";
    }

    function restorePrint() {
      if (!outer || !inner) {
        return;
      }
      printing = false;
      // Pulihkan penskala LANGSUNG di DOM. Tidak bisa hanya mengandalkan React,
      // karena bila nilai state tak berubah React tak menulis ulang gaya inline
      // sehingga override cetak ("none"/"auto") akan tertinggal di layar.
      const available = outer.clientWidth;
      const next = Math.min(1, available / designWidth);
      inner.style.width = `${designWidth}px`;
      inner.style.transform = `scale(${next})`;
      outer.style.height = `${inner.offsetHeight * next}px`;
      setScale(next);
      setHeight(inner.offsetHeight * next);
    }

    recalc();

    const observer = new ResizeObserver(recalc);
    observer.observe(outer);
    observer.observe(inner);

    window.addEventListener("beforeprint", applyPrint);
    window.addEventListener("afterprint", restorePrint);

    // Safari & sebagian browser tidak memicu beforeprint → pakai matchMedia.
    const mql = window.matchMedia("print");
    const onMedia = (event: MediaQueryListEvent) =>
      event.matches ? applyPrint() : restorePrint();
    mql.addEventListener?.("change", onMedia);

    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", applyPrint);
      window.removeEventListener("afterprint", restorePrint);
      mql.removeEventListener?.("change", onMedia);
    };
  }, [designWidth]);

  return (
    <div ref={outerRef} className="fit-to-width-outer" style={{ height }}>
      <div
        ref={innerRef}
        className="fit-to-width-inner"
        style={{
          width: designWidth,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
