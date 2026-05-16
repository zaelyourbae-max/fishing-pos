"use client";

import { Archive, MoreHorizontal, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ProductStatusActionButtonProps = {
  productId: number;
  productName: string;
  isActive: boolean;
  compact?: boolean;
};

export default function ProductStatusActionButton({
  productId,
  productName,
  isActive,
  compact = false,
}: ProductStatusActionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const Icon = compact ? MoreHorizontal : isActive ? Archive : RotateCcw;

  async function handleAction() {
    if (loading) {
      return;
    }

    if (isActive) {
      const confirmed = window.confirm(
        "Produk akan dinonaktifkan dan tidak muncul di POS. Riwayat transaksi tetap aman.",
      );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);

    try {
      const action = isActive ? "archive" : "restore";
      const response = await fetch(`/api/products/${productId}/${action}`, {
        method: "PATCH",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal mengubah status produk.");
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Gagal mengubah status produk.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={loading}
      className={
        compact
          ? "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:text-teal-200"
          : isActive
          ? "inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
          : "inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
      }
      aria-label={
        isActive
          ? `Nonaktifkan produk ${productName}`
          : `Aktifkan kembali produk ${productName}`
      }
    >
      <Icon size={16} />
      {compact
        ? null
        : loading
          ? "Memproses..."
          : isActive
            ? "Nonaktifkan"
            : "Aktifkan Kembali"}
    </button>
  );
}
