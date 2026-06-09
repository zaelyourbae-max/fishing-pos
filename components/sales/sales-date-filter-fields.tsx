"use client";

import { Calendar, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatDateID, parseIDDateInput } from "@/lib/date-format";

type SalesDateFilterFieldsProps = {
  from?: string;
  to?: string;
};

function rangeLabel(fromIso: string, toIso: string) {
  const fromText = fromIso ? formatDateID(fromIso) : "";
  const toText = toIso ? formatDateID(toIso) : "";

  if (fromText && toText) {
    return `${fromText} - ${toText}`;
  }

  if (fromText) {
    return `Dari ${fromText}`;
  }

  if (toText) {
    return `Sampai ${toText}`;
  }

  return "Semua tanggal";
}

export default function SalesDateFilterFields({
  from,
  to,
}: SalesDateFilterFieldsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fromHiddenRef = useRef<HTMLInputElement>(null);
  const toHiddenRef = useRef<HTMLInputElement>(null);

  // Nilai yang sudah diterapkan (untuk label pil).
  const [fromIso, setFromIso] = useState(from ?? "");
  const [toIso, setToIso] = useState(to ?? "");

  // Draft di dalam panel.
  const [open, setOpen] = useState(false);
  const [fromText, setFromText] = useState(from ? formatDateID(from) : "");
  const [toText, setToText] = useState(to ? formatDateID(to) : "");
  const [error, setError] = useState("");

  // Tutup panel saat klik di luar.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
    };
  }, [open]);

  function openPanel() {
    // Sinkronkan draft dengan nilai terpasang setiap kali dibuka.
    setFromText(fromIso ? formatDateID(fromIso) : "");
    setToText(toIso ? formatDateID(toIso) : "");
    setError("");
    setOpen(true);
  }

  function submitForm() {
    rootRef.current?.closest("form")?.requestSubmit();
  }

  function apply() {
    const trimmedFrom = fromText.trim();
    const trimmedTo = toText.trim();

    const parsedFrom = trimmedFrom ? parseIDDateInput(trimmedFrom) : "";
    const parsedTo = trimmedTo ? parseIDDateInput(trimmedTo) : "";

    if ((trimmedFrom && !parsedFrom) || (trimmedTo && !parsedTo)) {
      setError("Tanggal wajib memakai format dd/mm/yyyy, contoh 15/05/2026.");
      return;
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
      return;
    }

    setError("");
    setFromIso(parsedFrom ?? "");
    setToIso(parsedTo ?? "");

    if (fromHiddenRef.current) {
      fromHiddenRef.current.value = parsedFrom ?? "";
    }
    if (toHiddenRef.current) {
      toHiddenRef.current.value = parsedTo ?? "";
    }

    setOpen(false);
    submitForm();
  }

  function clearRange() {
    setFromText("");
    setToText("");
    setFromIso("");
    setToIso("");
    setError("");

    if (fromHiddenRef.current) {
      fromHiddenRef.current.value = "";
    }
    if (toHiddenRef.current) {
      toHiddenRef.current.value = "";
    }

    setOpen(false);
    submitForm();
  }

  const hasRange = Boolean(fromIso || toIso);

  return (
    <div
      ref={rootRef}
      className="relative col-span-2 space-y-1.5 sm:space-y-2 xl:col-span-1"
    >
      <input ref={fromHiddenRef} type="hidden" name="from" defaultValue={from ?? ""} />
      <input ref={toHiddenRef} type="hidden" name="to" defaultValue={to ?? ""} />

      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
        Tanggal
      </span>

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:px-4"
      >
        <Calendar className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
        <span
          className={`min-w-0 flex-1 truncate ${
            hasRange ? "" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {rangeLabel(fromIso, toIso)}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 min-w-[15rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Pilih rentang tanggal
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
              aria-label="Tutup pemilih tanggal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tanggal Mulai
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/yyyy"
                value={fromText}
                onChange={(event) => {
                  setFromText(event.target.value);
                  setError("");
                }}
                onBlur={() => {
                  const parsed = parseIDDateInput(fromText);
                  if (parsed) setFromText(formatDateID(parsed));
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-500/10"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tanggal Akhir
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/yyyy"
                value={toText}
                onChange={(event) => {
                  setToText(event.target.value);
                  setError("");
                }}
                onBlur={() => {
                  const parsed = parseIDDateInput(toText);
                  if (parsed) setToText(formatDateID(parsed));
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-500/10"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={apply}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm shadow-teal-600/15 transition-colors hover:bg-teal-700 active:bg-teal-700"
            >
              Terapkan
            </button>
            <button
              type="button"
              onClick={clearRange}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hapus
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
