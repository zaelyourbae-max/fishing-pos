"use client";

import { useState } from "react";
import { RefreshCw, Star } from "lucide-react";

type LoyaltyConfigCardProps = {
  initialInterval: number;
  initialMinPurchase: number;
};

function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function LoyaltyConfigCard({
  initialInterval,
  initialMinPurchase,
}: LoyaltyConfigCardProps) {
  const [interval, setIntervalValue] = useState(String(initialInterval));
  const [minPurchase, setMinPurchase] = useState(String(initialMinPurchase));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    const intervalNum = Number(interval);
    const minPurchaseNum = Number(minPurchase);

    if (!Number.isFinite(intervalNum) || intervalNum < 1) {
      setError("Interval transaksi minimal 1.");
      return;
    }
    if (!Number.isFinite(minPurchaseNum) || minPurchaseNum < 0) {
      setError("Minimal pembelian tidak valid.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/loyalty-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval: intervalNum,
          minPurchase: minPurchaseNum,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal menyimpan pengaturan.");
      }

      setMessage("Pengaturan loyalty tersimpan.");
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
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Star className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            Aturan Loyalty Customer
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atur kapan customer dapat benefit loyalty. Berlaku untuk semua
            customer.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Dapat loyalty setiap (transaksi valid)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={interval}
            onChange={(event) => {
              setIntervalValue(event.target.value.replace(/[^\d]/g, ""));
              setMessage("");
              setError("");
            }}
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:focus:ring-teal-500/10"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Contoh: 20 = tiap 20 transaksi sukses dapat 1 benefit.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Minimal pembelian agar berhak benefit
          </span>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={groupThousands(minPurchase)}
              onChange={(event) => {
                setMinPurchase(event.target.value.replace(/[^\d]/g, ""));
                setMessage("");
                setError("");
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-bold text-slate-950 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white dark:focus:ring-teal-500/10"
            />
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Belanja di bawah nilai ini tidak dihitung untuk benefit loyalty.
          </span>
        </label>
      </div>

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
