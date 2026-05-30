"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginResponse = {
  access_token: string;
  user: {
    name: string;
    email: string;
    role?: {
      name: string;
      slug: string;
    } | null;
  };
};

const TOKEN_KEY = "fishing_pos_token";
const USER_KEY = "fishing_pos_user";

export default function LoginForm() {
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
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<LoginResponse> & {
        message?: string;
      };

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

  return (
    <form
      onSubmit={login}
      className="w-full rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.11)] backdrop-blur sm:p-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0"
    >
      <div className="mb-5 text-center sm:mb-6">
        <div className="mb-5 lg:hidden">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            MEIJRVERSE°
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
            Retail Operating System
          </p>
        </div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-sans text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Welcome Back
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Login untuk melanjutkan ke sistem
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-800">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              enterKeyHint="next"
              placeholder="nama@meijrverse.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-11 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-800">
            Password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="done"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((current) => !current)}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={
                passwordVisible ? "Sembunyikan password" : "Tampilkan password"
              }
            >
              {passwordVisible ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-colors duration-200 hover:bg-teal-700 active:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{loading ? "Login..." : "Login"}</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
