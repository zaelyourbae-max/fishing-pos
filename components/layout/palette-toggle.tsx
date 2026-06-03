"use client";

import { Check, Palette as PaletteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  applyPalette,
  PALETTES,
  type PaletteId,
  readStoredPalette,
  storePalette,
} from "@/lib/theme/palettes";

export default function PaletteToggle() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PaletteId>("teal");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelected(readStoredPalette());
    setMounted(true);
  }, []);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const PANEL_W = 240;
      const left = Math.min(Math.max(8, r.right - PANEL_W), window.innerWidth - PANEL_W - 8);
      setPos({ top: r.bottom + 8, left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: PaletteId) {
    setSelected(id);
    storePalette(id);
    applyPalette(id);
    setOpen(false);
  }

  const current = PALETTES.find((p) => p.id === selected) ?? PALETTES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Pilih warna tampilan"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        style={mounted ? { color: current.accent } : undefined}
      >
        <PaletteIcon className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          className="fixed z-[60] w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            Warna Tampilan
          </p>
          <div className="grid grid-cols-1 gap-1">
            {PALETTES.map((p) => {
              const active = mounted && selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                    active
                      ? "bg-slate-100 dark:bg-slate-800"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex overflow-hidden rounded-md">
                    {p.swatches.map((c, i) => (
                      <span key={i} className="h-4 w-3" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {p.label}
                  </span>
                  {active ? (
                    <Check className="h-4 w-4 shrink-0" style={{ color: p.accent }} strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
