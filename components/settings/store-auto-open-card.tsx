"use client";

import { useState } from "react";
import { Clock, RefreshCw } from "lucide-react";

type StoreAutoOpenCardProps = {
  initialEnabled: boolean;
  initialTime: string;
};

export default function StoreAutoOpenCard({
  initialEnabled,
  initialTime,
}: StoreAutoOpenCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/store/auto-open", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, time }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal menyimpan pengaturan.");
      }

      setMessage("Pengaturan auto-buka tersimpan.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan pengaturan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            Buka Toko Otomatis
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Toko buka sendiri di jam yang ditentukan. Tutup tetap manual lewat
            closing.
          </p>
        </div>
      </div>

      <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Aktifkan auto-buka
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-5 w-5 accent-teal-600"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Jam buka
        </span>
        <input
          type="time"
          value={time}
          disabled={!enabled}
          onChange={(event) => setTime(event.target.value)}
          className="mt-2 h-12 w-full max-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:focus:ring-teal-500/10"
        />
      </label>

      {message ? (
        <p className="mt-3 text-sm font-semibold text-teal-700 dark:text-teal-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </section>
  );
}
