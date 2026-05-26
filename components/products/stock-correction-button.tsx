"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const STOCK_CORRECTION_REASONS = [
  { value: "DAMAGED", label: "Barang rusak" },
  { value: "LOST", label: "Barang hilang" },
  { value: "MISCOUNT", label: "Salah hitung stok" },
  { value: "FOUND_BONUS", label: "Bonus / stok ditemukan" },
  { value: "OTHER", label: "Lainnya" },
] as const;

type ProductForStockCorrection = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  stock: number;
};

type StockCorrectionButtonProps = {
  product: ProductForStockCorrection;
  compact?: boolean;
};

export default function StockCorrectionButton({
  product,
  compact = false,
}: StockCorrectionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [physicalStock, setPhysicalStock] = useState(String(product.stock));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const trimmedPhysicalStock = physicalStock.trim();
  const parsedPhysicalStock = Number(trimmedPhysicalStock);
  const isPhysicalStockValid =
    trimmedPhysicalStock !== "" &&
    Number.isInteger(parsedPhysicalStock) && parsedPhysicalStock >= 0;
  const difference = isPhysicalStockValid
    ? parsedPhysicalStock - product.stock
    : 0;
  const needsNotes = reason === "OTHER";
  const canSubmit =
    isPhysicalStockValid &&
    difference !== 0 &&
    Boolean(reason) &&
    (!needsNotes || notes.trim().length > 0);
  const differenceLabel = useMemo(() => {
    if (!isPhysicalStockValid) {
      return "-";
    }

    if (difference > 0) {
      return `+${difference}`;
    }

    return String(difference);
  }, [difference, isPhysicalStockValid]);

  function openModal() {
    setPhysicalStock(String(product.stock));
    setReason("");
    setNotes("");
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/products/${product.id}/stock-correction`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          physicalStock: parsedPhysicalStock,
          reason,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal menyimpan koreksi stok.");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan koreksi stok.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          compact
            ? "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-amber-500/60 dark:hover:text-amber-200"
            : "inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15 lg:w-auto"
        }
        aria-label={`Koreksi stok ${product.name}`}
        title="Koreksi stok"
      >
        <SlidersHorizontal size={16} />
        {compact ? null : "Koreksi Stok"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submit}
            data-mobile-sheet
            className="max-h-[92dvh] w-full max-w-lg scroll-pb-28 overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-950 shadow-xl [-webkit-overflow-scrolling:touch] dark:bg-slate-900 dark:text-slate-50 sm:rounded-2xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold sm:text-xl">Koreksi Stok</h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                  Gunakan Koreksi Stok hanya jika stok fisik berbeda dari
                  sistem. Untuk barang masuk dari pembelian, gunakan menu
                  Pembelian.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:mt-5 sm:p-4">
              <p className="line-clamp-2 break-words text-sm font-bold sm:text-base">
                {product.name}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {product.sku ?? "-"} - {product.category ?? "Tanpa kategori"}
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Stok sistem
                </span>
                <input
                  type="number"
                  value={product.stock}
                  readOnly
                  className="min-h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 sm:px-4 sm:py-3"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Stok fisik sebenarnya
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={physicalStock}
                  onChange={(event) => setPhysicalStock(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Masukkan stok fisik"
                />
              </label>
            </div>

            <div
              className={`mt-3 rounded-2xl border px-3 py-2 text-sm font-semibold sm:mt-4 sm:px-4 sm:py-3 ${
                difference === 0
                  ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  : difference > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              }`}
            >
              Selisih: {differenceLabel}
              {difference === 0 && isPhysicalStockValid
                ? " - tidak ada perubahan stok"
                : null}
            </div>

            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Alasan koreksi
                </span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                >
                  <option value="">Pilih alasan</option>
                  {STOCK_CORRECTION_REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Catatan {needsNotes ? "*" : "(opsional)"}
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:min-h-24 sm:px-4 sm:py-3"
                  placeholder="Contoh: 2 pcs rusak, stok rak sudah dicek ulang"
                />
              </label>
            </div>

            <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Koreksi"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
