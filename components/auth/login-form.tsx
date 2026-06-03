"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginResponse = {
  access_token: string;
  user: {
    name: string;
    email: string;
    role?: { name: string; slug: string } | null;
  };
};

const TOKEN_KEY = "fishing_pos_token";
const USER_KEY = "fishing_pos_user";

export default function LoginForm({ dark, mobile = false }: { dark: boolean; mobile?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<LoginResponse> & { message?: string };

      if (!response.ok || !data.access_token || !data.user) {
        throw new Error(data.message ?? "Login gagal.");
      }

      window.localStorage.setItem(TOKEN_KEY, data.access_token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      if (data.user.role?.slug === "owner" || data.user.role?.slug === "developer") {
        router.push("/dashboard");
      } else if (data.user.role?.slug === "cashier") {
        router.push("/cashier");
      } else {
        setError("Role tidak dikenali.");
      }

      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = dark
    ? "border border-white/10 bg-white/[0.07] text-white placeholder:text-slate-600 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20"
    : "border border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15";

  return (
    <form
      onSubmit={login}
      className={`w-full rounded-[1.75rem] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] transition-colors duration-500 sm:p-8 lg:rounded-none lg:p-0 lg:shadow-none lg:border-0 ${
        dark
          ? "border border-white/10 bg-[#0b1120] lg:bg-transparent"
          : "border border-teal-100 bg-white lg:bg-transparent"
      }`}
    >
      {/* Mobile branding — hanya tampil di desktop mobile view (bukan hero), skip kalau sudah ada hero */}
      {!mobile && (
        <div className="mb-5 lg:hidden sm:mb-6">
          <h1 className={`text-3xl font-black tracking-tight ${dark ? "text-white" : "text-slate-950"}`}>
            MEIJRVERSE°
          </h1>
          <p className={`mt-1 text-xs font-bold uppercase tracking-[0.22em] ${dark ? "text-teal-400" : "text-teal-700"}`}>
            Retail Operating System
          </p>
        </div>
      )}

      {/* Lock icon + title */}
      <div className="mb-5 text-center sm:mb-6">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, var(--color-teal-600), var(--color-teal-700))",
            boxShadow: dark
              ? "0 0 0 6px color-mix(in oklch, var(--color-teal-600) 12%, transparent), 0 0 28px color-mix(in oklch, var(--color-teal-500) 50%, transparent)"
              : "0 0 0 6px color-mix(in oklch, var(--color-teal-600) 10%, transparent), 0 4px 14px color-mix(in oklch, var(--color-teal-600) 30%, transparent)",
          }}
        >
          <LockKeyhole className="h-6 w-6 text-white" />
        </div>
        <h2 className={`mt-4 font-sans text-2xl font-black tracking-tight sm:text-3xl transition-colors duration-500 ${dark ? "text-white" : "text-slate-900"}`}>
          Masuk ke Sistem
        </h2>
        <p className={`mt-2 text-sm font-medium transition-colors duration-500 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Masukkan kredensial Anda
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-3.5">
        {/* Email */}
        <div>
          <label className={`mb-1.5 block text-sm font-bold transition-colors duration-500 ${dark ? "text-slate-300" : "text-slate-700"}`}>
            Email
          </label>
          <div className="relative">
            <Mail className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              enterKeyHint="next"
              placeholder="nama@meijrverse.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`min-h-12 w-full rounded-xl py-3 pl-10 pr-4 text-sm font-medium outline-none transition-all duration-300 ${inputClass}`}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className={`mb-1.5 block text-sm font-bold transition-colors duration-500 ${dark ? "text-slate-300" : "text-slate-700"}`}>
            Password
          </label>
          <div className="relative">
            <LockKeyhole className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="done"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`min-h-12 w-full rounded-xl py-3 pl-10 pr-12 text-sm font-medium outline-none transition-all duration-300 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg transition ${
                dark ? "text-slate-500 hover:bg-white/10 hover:text-slate-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              }`}
              aria-label={passwordVisible ? "Sembunyikan password" : "Tampilkan password"}
            >
              {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className={`my-1 h-px ${dark ? "bg-white/5" : "bg-slate-100"}`} />

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, var(--color-teal-600), var(--color-teal-700))",
            boxShadow: dark
              ? "0 4px 24px color-mix(in oklch, var(--color-teal-500) 40%, transparent)"
              : "0 4px 14px color-mix(in oklch, var(--color-teal-600) 30%, transparent)",
          }}
        >
          <span>{loading ? "Login..." : "Login"}</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

    </form>
  );
}
