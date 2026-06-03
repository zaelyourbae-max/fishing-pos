"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "fishing_pos_theme";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    queueMicrotask(() => {
      const currentTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
      setTheme(currentTheme);
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    window.localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [mounted, theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const dark = theme === "dark";

  /* skeleton saat belum mounted */
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Memuat theme"
        className="relative flex h-6 w-11 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
      className="relative flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      style={{
        background: dark ? "color-mix(in oklab, var(--color-teal-500) 28%, transparent)" : "var(--color-teal-600)",
        borderColor: dark ? "color-mix(in oklab, var(--color-teal-500) 40%, transparent)" : "var(--color-teal-700)",
      }}
    >
      <span
        className="absolute flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
        style={{
          left: dark ? "3px" : "calc(100% - 19px)",
          background: dark ? "#1e293b" : "white",
          transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease",
        }}
      >
        {dark ? (
          <Moon className="h-2.5 w-2.5 text-teal-400" />
        ) : (
          <Sun className="h-2.5 w-2.5 text-teal-600" />
        )}
      </span>
    </button>
  );
}
