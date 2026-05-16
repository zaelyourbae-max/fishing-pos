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
      className="w-full rounded-2xl border border-zinc-200 bg-white p-6"
    >
      <h1 className="font-sans text-3xl font-bold tracking-normal">Fishing POS</h1>
      <p className="mt-1 text-sm text-zinc-500">Login sistem kasir</p>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-4 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-4 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-xl bg-teal-600 py-3 font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Login..." : "Login"}
        </button>
      </div>
    </form>
  );
}
