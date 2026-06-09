"use client";

import { Check, ChevronDown, User } from "lucide-react";
import { useState } from "react";

type Props = {
  initialName: string;
  email: string;
  initialPhone: string;
};

export default function EditProfileCard({
  initialName,
  email,
  initialPhone,
}: Props) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "Gagal menyimpan profil.");
      }

      setMessage("Profil berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
          <User className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
            Edit Profil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Perbarui nama dan nomor HP-mu.
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Nama
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Email <span className="font-normal text-slate-400">(tidak bisa diubah)</span>
          </span>
          <input
            type="email"
            value={email}
            disabled
            readOnly
            className="min-h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Nomor HP
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
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
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </button>
        </div>
      </form>
    </details>
  );
}
