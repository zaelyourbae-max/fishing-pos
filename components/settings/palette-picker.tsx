"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyPalette,
  PALETTES,
  type PaletteId,
  readStoredPalette,
  storePalette,
} from "@/lib/theme/palettes";

export default function PalettePicker() {
  const [selected, setSelected] = useState<PaletteId>("teal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSelected(readStoredPalette());
    setMounted(true);
  }, []);

  function choose(id: PaletteId) {
    setSelected(id);
    storePalette(id);
    applyPalette(id);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PALETTES.map((p) => {
        const active = mounted && selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id)}
            aria-pressed={active}
            className={`group relative flex flex-col gap-2 rounded-2xl border p-3 text-left transition ${
              active
                ? "border-teal-500 ring-2 ring-teal-500/40"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <div className="flex overflow-hidden rounded-lg">
              {p.swatches.map((c, i) => (
                <span key={i} className="h-7 flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {p.label}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {p.description}
                </p>
              </div>
              {active ? (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: p.accent }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
