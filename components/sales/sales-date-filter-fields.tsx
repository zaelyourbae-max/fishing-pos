"use client";

import { useEffect, useRef, useState } from "react";

import { formatDateID, parseIDDateInput } from "@/lib/date-format";

type SalesDateFilterFieldsProps = {
  from?: string;
  to?: string;
};

type NormalizedDate =
  | {
      ok: true;
      value: string;
      text: string;
    }
  | {
      ok: false;
    };

function normalizeDateInput(value: string): NormalizedDate {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: "", text: "" };
  }

  const parsed = parseIDDateInput(trimmed);

  if (!parsed) {
    return { ok: false };
  }

  return { ok: true, value: parsed, text: formatDateID(parsed) };
}

export default function SalesDateFilterFields({
  from,
  to,
}: SalesDateFilterFieldsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fromHiddenRef = useRef<HTMLInputElement>(null);
  const toHiddenRef = useRef<HTMLInputElement>(null);
  const [fromText, setFromText] = useState(from ? formatDateID(from) : "");
  const [toText, setToText] = useState(to ? formatDateID(to) : "");
  const [error, setError] = useState("");

  function normalizeField(field: "from" | "to", value: string) {
    const normalized = normalizeDateInput(value);

    if (!normalized.ok) {
      setError("Tanggal filter wajib memakai format dd/mm/yyyy.");
      return;
    }

    setError("");

    if (field === "from") {
      setFromText(normalized.text);
      if (fromHiddenRef.current) {
        fromHiddenRef.current.value = normalized.value;
      }
      return;
    }

    setToText(normalized.text);
    if (toHiddenRef.current) {
      toHiddenRef.current.value = normalized.value;
    }
  }

  useEffect(() => {
    const form = rootRef.current?.closest("form");

    if (!form) {
      return;
    }

    function handleSubmit(event: SubmitEvent) {
      const normalizedFrom = normalizeDateInput(fromText);
      const normalizedTo = normalizeDateInput(toText);

      if (!normalizedFrom.ok || !normalizedTo.ok) {
        event.preventDefault();
        setError("Tanggal filter wajib memakai format dd/mm/yyyy.");
        return;
      }

      if (
        normalizedFrom.value &&
        normalizedTo.value &&
        normalizedFrom.value > normalizedTo.value
      ) {
        event.preventDefault();
        setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
        return;
      }

      if (fromHiddenRef.current) {
        fromHiddenRef.current.value = normalizedFrom.value;
      }

      if (toHiddenRef.current) {
        toHiddenRef.current.value = normalizedTo.value;
      }

      setError("");
    }

    form.addEventListener("submit", handleSubmit);

    return () => {
      form.removeEventListener("submit", handleSubmit);
    };
  }, [fromText, toText]);

  return (
    <div ref={rootRef} className="contents">
      <input ref={fromHiddenRef} type="hidden" name="from" defaultValue={from ?? ""} />
      <input ref={toHiddenRef} type="hidden" name="to" defaultValue={to ?? ""} />

      <label className="space-y-1.5 sm:space-y-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
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
          onBlur={(event) => normalizeField("from", event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-500/10 sm:h-12 sm:px-4"
        />
      </label>

      <label className="space-y-1.5 sm:space-y-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
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
          onBlur={(event) => normalizeField("to", event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-500/10 sm:h-12 sm:px-4"
        />
      </label>

      {error ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-300 sm:text-sm md:col-span-2 xl:col-span-6">
          {error}
        </p>
      ) : null}
    </div>
  );
}
