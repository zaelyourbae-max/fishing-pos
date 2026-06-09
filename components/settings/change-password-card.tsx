"use client";

import { Check, ChevronDown, KeyRound } from "lucide-react";
import { useState } from "react";

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword) {
      setError("Kata sandi lama wajib diisi.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "Gagal mengganti kata sandi.");
      }

      setMessage("Kata sandi berhasil diganti.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengganti kata sandi.",
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100";

  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
            Ganti Kata Sandi
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Demi keamanan, masukkan kata sandi lama dulu.
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kata Sandi Lama
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kata Sandi Baru
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            className={`${inputClass} placeholder:text-slate-400 dark:placeholder:text-slate-500`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Ulangi Kata Sandi Baru
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {message ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-300">
            <Check className="h-4 w-4 shrink-0" /> {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            {saving ? "Menyimpan..." : "Ganti Kata Sandi"}
          </button>
        </div>
      </form>
    </details>
  );
}
