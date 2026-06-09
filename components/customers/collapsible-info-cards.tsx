"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleInfoCardsProps = {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

// Bungkus deretan kartu info customer agar tampil ringkas 1 baris,
// lalu bisa dilipat / dibuka sesuai kebutuhan owner.
export default function CollapsibleInfoCards({
  summary,
  children,
  defaultOpen = false,
}: CollapsibleInfoCardsProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 sm:px-5 sm:py-4"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 p-3.5 dark:border-slate-800 sm:p-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
