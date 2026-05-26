"use client";

import {
  type FocusEvent,
  type FocusEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isMobileViewport = useCallback(() => {
    return window.matchMedia("(max-width: 639px)").matches;
  }, []);

  const scrollToSearchResults = useCallback(() => {
    if (!isMobileViewport()) {
      return;
    }

    const target =
      document.querySelector("[data-search-results]") ?? wrapperRef.current;

    target?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [isMobileViewport]);

  function openMobileSearch(event: FocusEvent<HTMLInputElement>) {
    onFocus?.(event);

    if (!isMobileViewport()) {
      return;
    }

    setMobileSearchOpen(true);
    window.setTimeout(() => {
      mobileInputRef.current?.focus();
      scrollToSearchResults();
    }, 0);
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(value);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(draft);
      scrollToSearchResults();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, draft, onSearch, scrollToSearchResults]);

  function clearSearch() {
    setDraft("");
    onSearch("");
    window.setTimeout(scrollToSearchResults, 0);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
      <input
        value={draft}
        onFocus={openMobileSearch}
        onBlur={onBlur}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            clearSearch();
            closeMobileSearch();
          }
        }}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:pl-12 sm:pr-12"
        placeholder={placeholder}
        autoComplete="off"
      />
      {draft ? (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:right-3"
          aria-label="Bersihkan pencarian"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {mobileSearchOpen ? (
        <>
          <div className="h-20 sm:hidden" />
          <div className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:hidden">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={mobileInputRef}
                  value={draft}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      clearSearch();
                      closeMobileSearch();
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={placeholder}
                  autoComplete="off"
                />
                {draft ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeMobileSearch}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                Tutup
              </button>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Hasil pencarian tampil langsung di area daftar di bawah.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
