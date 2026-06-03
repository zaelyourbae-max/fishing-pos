"use client";

import { useEffect, useState } from "react";
import LoginForm from "./login-form";
import PaletteToggle from "@/components/layout/palette-toggle";
import { applyPalette, readStoredPalette } from "@/lib/theme/palettes";

const THEME_KEY = "fishing_pos_theme";

export default function LoginPageClient() {
  const [dark, setDark] = useState(true);

  /* Baca tema + palet dari localStorage saat pertama load */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      const isDark = saved ? saved === "dark" : document.documentElement.classList.contains("dark");
      setDark(isDark);
    } catch {
      setDark(true);
    }

    try {
      applyPalette(readStoredPalette());
    } catch {
      /* ignore */
    }
  }, []);

  /* Sync ke localStorage + class html saat toggle */
  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // ignore
    }
  }, [dark]);

  /* ── Toggle pill ── */
  const Toggle = (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle dark/light mode"
      className="relative flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none"
      style={{
        background: dark
          ? "color-mix(in oklch, var(--color-teal-500) 25%, transparent)"
          : "var(--color-teal-600)",
        border: dark
          ? "1px solid color-mix(in oklch, var(--color-teal-500) 30%, transparent)"
          : "1px solid var(--color-teal-700)",
      }}
    >
      <span
        className="absolute flex h-5 w-5 items-center justify-center rounded-full shadow-md"
        style={{
          left: dark ? "3px" : "calc(100% - 23px)",
          background: dark ? "#1e293b" : "white",
          transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease",
        }}
      >
        {dark ? (
          <svg className="h-3 w-3 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen transition-colors duration-500" style={{
      background: dark
        ? "linear-gradient(155deg, #020617 0%, #0b1a2e 50%, #0d2137 100%)"
        : "linear-gradient(135deg, #f0fdf9 0%, #e6f7f4 50%, #d1fae5 100%)",
    }}>

      {/* ════════════════════════════════════════
          MOBILE layout (hidden on lg+)
      ════════════════════════════════════════ */}
      <div
        className="flex min-h-screen flex-col lg:hidden"
        style={{
          background: dark
            ? "linear-gradient(180deg, #0f172a 0%, #0c1f1d 60%, #073330 100%)"
            : `linear-gradient(175deg, var(--color-teal-700) 0%, var(--color-teal-600) 60%, var(--color-teal-500) 100%)`,
        }}
      >
        {/* Hero top */}
        <div className="relative flex flex-col overflow-hidden px-6 pb-16 pt-14" style={{ minHeight: "48vh" }}>
          {/* Glow */}
          {dark && (
            <div className="pointer-events-none absolute left-[-60px] top-[-60px] h-[320px] w-[320px] rounded-full"
              style={{ background: "radial-gradient(circle, var(--color-teal-500), transparent)", filter: "blur(80px)", opacity: 0.2 }} />
          )}

          {/* Kontrol — pojok kanan atas */}
          <div className="absolute right-5 top-5 z-20 flex items-center gap-2.5">
            <PaletteToggle />
            {Toggle}
          </div>

          {/* Branding */}
          <div className="relative z-10 mt-4">
            <h1 className="text-[2.6rem] font-black leading-none tracking-tight text-white">
              SeaHorse Company
            </h1>
            <p className={`mt-1.5 text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-teal-400" : "text-white/80"}`}>
              by MeijrVerse°
            </p>
            <p className={`mt-4 max-w-[260px] text-sm font-medium leading-relaxed ${dark ? "text-slate-400" : "text-white/75"}`}>
              Sistem kasir yang cepat, akurat, dan terpercaya.
            </p>
          </div>

          {/* Pills */}
          <div className="relative z-10 mt-6 flex flex-wrap gap-2">
            {["Kasir", "Inventori", "Laporan"].map((item) => (
              <span key={item} className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: dark
                    ? "color-mix(in oklch, var(--color-teal-500) 12%, transparent)"
                    : "rgba(255,255,255,0.2)",
                  border: dark
                    ? "1px solid color-mix(in oklch, var(--color-teal-500) 25%, transparent)"
                    : "1px solid rgba(255,255,255,0.3)",
                  color: dark ? "var(--color-teal-300)" : "white",
                }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Floating card */}
        <div className="-mt-8 flex-1 px-3.5 pb-6">
          <div
            className="h-full rounded-[1.875rem] px-5 pb-7 pt-8 transition-colors duration-500"
            style={{
              background: dark ? "linear-gradient(160deg, #0d1424 0%, #091018 100%)" : "white",
              border: dark
                ? "1px solid color-mix(in oklch, var(--color-teal-500) 30%, transparent)"
                : "1px solid color-mix(in oklch, var(--color-teal-600) 20%, transparent)",
              boxShadow: dark
                ? "0 -18px 50px color-mix(in oklch, var(--color-teal-600) 28%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--color-teal-500) 6%, transparent), inset 0 1px 0 color-mix(in oklch, var(--color-teal-500) 50%, transparent)"
                : "0 -20px 40px color-mix(in oklch, var(--color-teal-600) 15%, transparent), inset 0 1px 0 color-mix(in oklch, var(--color-teal-600) 20%, transparent)",
            }}
          >
            <LoginForm dark={dark} mobile />
            <p className={`mt-5 text-center text-xs font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>
              © 2026 MEIJRVERSE°. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          DESKTOP layout (hidden below lg)
      ════════════════════════════════════════ */}
      <div className="relative hidden min-h-screen items-center justify-center px-6 py-8 lg:flex">

        {/* Glow blobs — dark only */}
        {dark && (
          <>
            <div className="pointer-events-none fixed left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, var(--color-teal-500), transparent)", filter: "blur(90px)" }} />
            <div className="pointer-events-none fixed bottom-[-10%] right-[-5%] h-[400px] w-[400px] rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, var(--color-teal-400), transparent)", filter: "blur(80px)" }} />
          </>
        )}

        {/* Kontrol — fixed kanan atas */}
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2.5">
          <PaletteToggle />
          {Toggle}
        </div>

        {/* Card */}
        <div
          className="grid w-full max-w-7xl items-stretch overflow-hidden rounded-[2.15rem] transition-all duration-500"
          style={{
            gridTemplateColumns: "52fr 48fr",
            minHeight: "min(620px, 85vh)",
            border: dark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid color-mix(in oklch, var(--color-teal-600) 15%, transparent)",
            boxShadow: dark
              ? "0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
              : "0 30px 80px color-mix(in oklch, var(--color-teal-600) 15%, transparent)",
          }}
        >
          {/* Left panel */}
          <section
            className="relative overflow-hidden transition-all duration-500"
            style={{
              background: dark
                ? "linear-gradient(155deg, #0f172a 0%, #0d2a26 60%, var(--color-teal-900) 100%)"
                : `linear-gradient(155deg, var(--color-teal-700) 0%, var(--color-teal-600) 60%, var(--color-teal-500) 100%)`,
            }}
          >
            {dark && (
              <>
                <div className="pointer-events-none absolute left-[-60px] top-[-60px] h-[320px] w-[320px] rounded-full opacity-30"
                  style={{ background: "radial-gradient(circle, var(--color-teal-500), transparent)", filter: "blur(70px)" }} />
                <div className="pointer-events-none absolute bottom-[-40px] right-[-40px] h-[240px] w-[240px] rounded-full opacity-20"
                  style={{ background: "radial-gradient(circle, var(--color-teal-600), transparent)", filter: "blur(60px)" }} />
              </>
            )}
            <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
              <div>
                <h1 className="text-[3rem] font-black leading-none tracking-tight text-white">
                  SeaHorse Company
                </h1>
                <p className={`mt-2 text-sm font-bold uppercase tracking-[0.18em] ${dark ? "text-teal-400" : "text-white/80"}`}>
                  by MeijrVerse°
                </p>
                <p className={`mt-5 max-w-[260px] text-sm font-medium leading-relaxed ${dark ? "text-slate-400" : "text-white/75"}`}>
                  Kelola toko Anda dengan sistem kasir yang cepat, akurat, dan terpercaya.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  {["Kasir", "Inventori", "Laporan"].map((item) => (
                    <span key={item} className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: dark
                          ? "color-mix(in oklch, var(--color-teal-500) 15%, transparent)"
                          : "rgba(255,255,255,0.2)",
                        border: dark
                          ? "1px solid color-mix(in oklch, var(--color-teal-500) 20%, transparent)"
                          : "1px solid rgba(255,255,255,0.3)",
                        color: dark ? "var(--color-teal-300)" : "white",
                      }}>
                      {item}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-500"
                  style={{
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.2)",
                    border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.3)",
                  }}>
                  <div className="flex -space-x-1.5">
                    {(["var(--color-teal-600)", "var(--color-teal-700)", "var(--color-teal-800)"] as const).map((color, i) => (
                      <div key={i} className="h-6 w-6 rounded-full border-2"
                        style={{ backgroundColor: color, borderColor: dark ? "#0f172a" : "var(--color-teal-600)" }} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${dark ? "text-slate-400" : "text-white/80"}`}>
                    Aman &bull; Cepat &bull; Terpercaya
                  </p>
                </div>
                <p className={`text-xs font-medium ${dark ? "text-slate-600" : "text-white/50"}`}>
                  © 2026 MEIJRVERSE°. All rights reserved.
                </p>
              </div>
            </div>
          </section>

          {/* Right panel */}
          <section
            className="relative flex items-center justify-center overflow-y-auto px-14 py-10 transition-colors duration-500"
            style={{ background: dark ? "linear-gradient(155deg, #0b1120 0%, #0f172a 100%)" : "white" }}
          >
            <div className="w-full max-w-[360px]">
              <LoginForm dark={dark} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
