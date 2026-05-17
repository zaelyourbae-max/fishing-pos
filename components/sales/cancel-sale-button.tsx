"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CancelSaleButtonProps = {
  saleId: string;
  invoiceNumber: string;
};

export default function CancelSaleButton({
  saleId,
  invoiceNumber,
}: CancelSaleButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitCancel() {
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 5) {
      setError("Alasan pembatalan wajib diisi minimal 5 karakter.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/sales/${saleId}/cancel`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancel_reason: trimmedReason,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal membatalkan transaksi.");
      }

      setOpen(false);
      setReason("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membatalkan transaksi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-200 dark:hover:bg-rose-500/10"
      >
        Batalkan
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Batalkan transaksi
              </p>
              <h2 className="mt-1 text-lg font-bold">{invoiceNumber}</h2>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Alasan pembatalan
              </span>
              <textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError("");
                }}
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-slate-800 dark:bg-slate-900 dark:focus:ring-rose-500/10"
                placeholder="Contoh: pelanggan tidak jadi bayar QRIS"
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                }}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-800 dark:text-slate-300"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? "Membatalkan..." : "Batalkan Transaksi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
