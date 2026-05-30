"use client";

type StockOpnameApproveDialogProps = {
  open: boolean;
  loading: boolean;
  totalItems: number;
  changedItems: number;
  onClose: () => void;
  onConfirm: () => void;
};

export default function StockOpnameApproveDialog({
  open,
  loading,
  totalItems,
  changedItems,
  onClose,
  onConfirm,
}: StockOpnameApproveDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Setujui Stock Opname?
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Setelah disetujui, stok semua produk akan diperbarui sesuai hasil
          hitung fisik. Tindakan ini tidak bisa dibatalkan.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Total item
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalItems}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Item berubah
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {changedItems}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Menyetujui..." : "Setujui & Update Stok"}
          </button>
        </div>
      </div>
    </div>
  );
}
