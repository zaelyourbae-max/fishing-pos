"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

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
  const [isPending, startTransition] = useTransition();
  const latestValue = useRef(initialValue);
  const resetParamKey = resetParams.join(",");

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
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, name, pathname, resetParamKey, router, searchParams, value]);

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
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
      <input
        name={name}
        value={value}
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
    </div>
  );
}
