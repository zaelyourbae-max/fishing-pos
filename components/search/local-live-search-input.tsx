"use client";

import { type FocusEventHandler, useEffect, useState } from "react";
import { Search, X } from "lucide-react";

type LocalLiveSearchInputProps = {
  value: string;
  onSearch: (value: string) => void;
  placeholder: string;
  debounceMs?: number;
  className?: string;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
};

export default function LocalLiveSearchInput({
  value,
  onSearch,
  placeholder,
  debounceMs = 180,
  className = "",
  onFocus,
  onBlur,
}: LocalLiveSearchInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(value);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(draft);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, draft, onSearch]);

  function clearSearch() {
    setDraft("");
    onSearch("");
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        value={draft}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            clearSearch();
          }
        }}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
        placeholder={placeholder}
        autoComplete="off"
      />
      {draft ? (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Bersihkan pencarian"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
