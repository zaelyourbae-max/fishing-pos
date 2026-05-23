"use client";

import { useEffect } from "react";

const THEME_KEY = "fishing_pos_theme";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      const theme = savedTheme === "dark" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
    } catch {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return null;
}
