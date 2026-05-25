"use client";

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
  const [email, setEmail] = useState("cashier@toko.local");
  const [password, setPassword] = useState("cashier123");
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
      className="w-full rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.07)] sm:p-8"
    >
      <div className="mb-5 sm:mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
          MEIJRVERSE Retail System
        </p>
        <h1 className="mt-2.5 font-sans text-2xl font-extrabold tracking-tight text-slate-950 sm:mt-3 sm:text-3xl">
          Fishing POS
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Login sistem kasir dan operasional toko.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3.5 sm:space-y-4">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-base"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-900/10 transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:rounded-2xl sm:py-3 sm:text-base"
        >
          {loading ? "Login..." : "Login"}
        </button>
      </div>
    </form>
  );
}
