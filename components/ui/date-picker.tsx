"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateID } from "@/lib/date-format";

type Props = {
  /** Controlled value as YYYY-MM-DD */
  value?: string;
  /** Uncontrolled initial value as YYYY-MM-DD */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** When set, renders a hidden input so native GET forms can submit the value. */
  name?: string;
  /** Latest selectable date (YYYY-MM-DD). Dates after this are disabled. */
  max?: string;
  /** Earliest selectable date (YYYY-MM-DD). Dates before this are disabled. */
  min?: string;
  placeholder?: string;
  className?: string;
};

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse YYYY-MM-DD -> {y,m,d} (m is 1-based). Returns null if invalid. */
function parseISO(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export default function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  max,
  min,
  placeholder = "Pilih tanggal",
  className = "",
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = isControlled ? (value ?? "") : internal;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Month currently shown in the calendar grid.
  const initialView = parseISO(current) ?? parseISO(max) ?? null;
  const today = new Date();
  const [viewYear, setViewYear] = useState(initialView?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(
    initialView ? initialView.m - 1 : today.getMonth(),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openCalendar() {
    // Re-sync the visible month to the selected value when opening.
    const sel = parseISO(current);
    if (sel) {
      setViewYear(sel.y);
      setViewMonth(sel.m - 1);
    }
    setOpen(true);
  }

  function select(iso: string) {
    if (!isControlled) setInternal(iso);
    onChange?.(iso);
    setOpen(false);
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function isDisabled(iso: string) {
    if (max && iso > max) return true;
    if (min && iso < min) return true;
    return false;
  }

  const displayLabel = current ? formatDateID(current) : "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={current} /> : null}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-900 transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-teal-500/20"
      >
        <span className={displayLabel ? "" : "text-slate-400 dark:text-slate-500"}>
          {displayLabel || placeholder}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {/* Header: month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {MONTHS_ID[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS_ID.map((w) => (
              <div
                key={w}
                className="flex h-7 items-center justify-center text-[11px] font-semibold text-slate-400 dark:text-slate-500"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const iso = toISO(viewYear, viewMonth + 1, day);
              const disabled = isDisabled(iso);
              const isSelected = iso === current;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(iso)}
                  className={[
                    "flex h-9 items-center justify-center rounded-lg text-sm font-medium transition",
                    disabled
                      ? "cursor-not-allowed text-slate-300 dark:text-slate-700"
                      : isSelected
                        ? "bg-teal-600 text-white"
                        : "text-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-200 dark:hover:bg-teal-500/10 dark:hover:text-teal-300",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick "today" shortcut */}
          {!max || toISO(today.getFullYear(), today.getMonth() + 1, today.getDate()) <= max ? (
            <button
              type="button"
              onClick={() =>
                select(toISO(today.getFullYear(), today.getMonth() + 1, today.getDate()))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-slate-700 dark:text-teal-300 dark:hover:bg-teal-500/10"
            >
              Hari ini
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
