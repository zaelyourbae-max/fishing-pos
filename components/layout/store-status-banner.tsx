"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DoorOpen, Lock, RefreshCw } from "lucide-react";

type StoreStatusBannerProps = {
  closedAt: string | null;
};

function formatClosedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StoreStatusBanner({ closedAt }: StoreStatusBannerProps) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const closedLabel = formatClosedAt(closedAt);

  async function openStore() {
    setOpening(true);
    setError("");

    try {
      const response = await fetch("/api/store/open", { method: "POST" });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? "Gagal membuka toko.");
      }

      router.refresh();
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Gagal membuka toko.",
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
            <Lock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-rose-800 dark:text-rose-200">
              Toko sedang TUTUP
            </p>
            <p className="mt-0.5 text-sm text-rose-700 dark:text-rose-300">
              Penjualan, pembelian, retur, dan produk terkunci.
              {closedLabel ? ` Ditutup ${closedLabel}.` : ""}
            </p>
            {error ? (
              <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={openStore}
          disabled={opening}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {opening ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <DoorOpen className="h-4 w-4" />
          )}
          {opening ? "Membuka..." : "Buka Toko"}
        </button>
      </div>
    </div>
  );
}
