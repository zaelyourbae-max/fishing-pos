"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PaymentProofActionButtonProps = {
  saleId: string;
  invoiceNumber: string;
};

export default function PaymentProofActionButton({
  saleId,
  invoiceNumber,
}: PaymentProofActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function uploadProof() {
    if (!file) {
      setError("Pilih file bukti pembayaran QRIS terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch(`/api/sales/${saleId}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal upload bukti pembayaran.");
      }

      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal upload bukti pembayaran.",
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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-500/10"
      >
        <Upload className="h-4 w-4" />
        Upload Bukti
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Upload bukti QRIS
              </p>
              <h2 className="mt-1 text-lg font-bold">{invoiceNumber}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Bukti yang diupload akan menyelesaikan transaksi menjadi SUCCESS / PAID.
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                File bukti pembayaran
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-amber-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:file:bg-amber-500/15 dark:file:text-amber-200"
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
                onClick={uploadProof}
                disabled={loading || !file}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Mengupload..." : "Upload Bukti"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
