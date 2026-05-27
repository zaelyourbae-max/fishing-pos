"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cleanupStaleGlobalInteractionState } from "@/lib/global-interaction-state";

type LiveSearchInputProps = {
  name?: string;
  initialValue?: string;
  placeholder: string;
  debounceMs?: number;
  className?: string;
  resetParams?: string[];
};

export default function LiveSearchInput({
  name = "q",
  initialValue = "",
  placeholder,
  debounceMs = 300,
  className = "",
  resetParams = ["page"],
}: LiveSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const latestValue = useRef(initialValue);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resetParamKey = resetParams.join(",");

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

  function openMobileSearch() {
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
    mobileInputRef.current?.blur();
    document.body.classList.remove("mobile-search-active");
    setMobileSearchOpen(false);
    window.setTimeout(cleanupStaleGlobalInteractionState, 220);
  }

  useEffect(() => {
    if (!mobileSearchOpen) {
      return;
    }

    document.body.classList.add("mobile-search-active");

    const handleViewportChange = () => {
      window.setTimeout(scrollToSearchResults, 80);
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      document.body.classList.remove("mobile-search-active");
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
      window.setTimeout(cleanupStaleGlobalInteractionState, 220);
    };
  }, [mobileSearchOpen, scrollToSearchResults]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setValue(initialValue);
      latestValue.current = initialValue;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialValue]);

  useEffect(() => {
    if (latestValue.current === value) {
      return;
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const nextValue = value.trim();

      if (nextValue) {
        params.set(name, nextValue);
      } else {
        params.delete(name);
      }

      for (const key of resetParamKey.split(",").filter(Boolean)) {
        params.delete(key);
      }

      latestValue.current = value;
      const query = params.toString();

      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
      window.setTimeout(scrollToSearchResults, 120);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [
    debounceMs,
    name,
    pathname,
    resetParamKey,
    router,
    scrollToSearchResults,
    searchParams,
    value,
  ]);

  function clearSearch() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete(name);

    for (const key of resetParamKey.split(",").filter(Boolean)) {
      params.delete(key);
    }

    latestValue.current = "";
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
    window.setTimeout(scrollToSearchResults, 120);
  }

  function submitNow() {
    const params = new URLSearchParams(searchParams.toString());
    const nextValue = value.trim();

    if (nextValue) {
      params.set(name, nextValue);
    } else {
      params.delete(name);
    }

    for (const key of resetParamKey.split(",").filter(Boolean)) {
      params.delete(key);
    }

    latestValue.current = value;
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
    window.setTimeout(scrollToSearchResults, 120);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
      <input
        type="search"
        name={name}
        value={value}
        onFocus={openMobileSearch}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            clearSearch();
          }

          if (event.key === "Enter") {
            event.preventDefault();
            submitNow();
          }
        }}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:pl-12 sm:pr-12"
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value ? (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:right-3"
          aria-label="Bersihkan pencarian"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {isPending ? (
        <span className="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-teal-500" />
      ) : null}

      {mobileSearchOpen ? (
        <>
          <div className="h-20 sm:hidden" />
          <div
            data-mobile-search-dock
            className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.65rem)] shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:hidden"
          >
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  ref={mobileInputRef}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeMobileSearch();
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitNow();
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={placeholder}
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {value ? (
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
