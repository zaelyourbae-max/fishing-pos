"use client";

import { useState } from "react";

export type StockOpnamePreviewRow = {
  rowNumber: number;
  sessionNumber: string;
  itemId: string;
  productId: number | null;
  sku: string;
  name: string;
  systemStock: number | null;
  physicalStock: number | null;
  difference: number | null;
  notes: string;
  status: "valid" | "error";
  errors: string[];
};

export type StockOpnamePreview = {
  rows: StockOpnamePreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
  };
};

type StockOpnameImportPanelProps = {
  sessionId: string;
  canEdit: boolean;
  onApplied: () => void;
};

export default function StockOpnameImportPanel({
  sessionId,
  canEdit,
  onApplied,
}: StockOpnameImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StockOpnamePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handlePreview() {
    if (!file) {
      setError("Pilih file .xlsx terlebih dahulu.");
      return;
    }

    setLoadingPreview(true);
    setMessage("");
    setError("");
    setPreview(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/stock-opnames/${sessionId}/import/preview`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setLoadingPreview(false);

    if (!response.ok) {
      setError(payload.message ?? "Gagal preview Excel.");
      return;
    }

    setPreview(payload.data);
    setMessage("Preview berhasil. Periksa error sebelum apply.");
  }

  async function handleApply() {
    if (!preview || preview.summary.errorRows > 0) {
      return;
    }

    setLoadingApply(true);
    setMessage("");
    setError("");

    const response = await fetch(`/api/stock-opnames/${sessionId}/import/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: preview.rows,
      }),
    });
    const payload = await response.json();

    setLoadingApply(false);

    if (!response.ok) {
      setError(payload.message ?? "Gagal apply import.");
      return;
    }

    setMessage("Import berhasil mengisi stok fisik sesi SO.");
    setPreview(null);
    setFile(null);
    onApplied();
  }

  return (
    <section className="surface-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Import Excel
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Upload hanya mengisi stok fisik item SO. Product.stock tidak berubah
            sebelum approve.
          </p>
        </div>
        <a
          href={`/api/stock-opnames/${sessionId}/template`}
          className="inline-flex rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Download Template
        </a>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            File Excel .xlsx
          </label>
          <input
            type="file"
            accept=".xlsx"
            disabled={!canEdit}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage("");
              setError("");
            }}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={handlePreview}
          disabled={!canEdit || loadingPreview}
          className="rounded-2xl border border-teal-300 px-5 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-500/10"
        >
          {loadingPreview ? "Preview..." : "Preview"}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={
            !canEdit ||
            !preview ||
            preview.summary.errorRows > 0 ||
            loadingApply
          }
          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingApply ? "Apply..." : "Apply Import"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
            <div>Total row: {preview.summary.totalRows}</div>
            <div>Valid: {preview.summary.validRows}</div>
            <div>Error: {preview.summary.errorRows}</div>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Sistem</th>
                  <th className="px-4 py-3">Fisik</th>
                  <th className="px-4 py-3">Selisih</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={`${row.rowNumber}-${row.itemId}`}>
                    <td className="px-4 py-3">{row.rowNumber}</td>
                    <td className="px-4 py-3">{row.sku || "-"}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.systemStock ?? "-"}</td>
                    <td className="px-4 py-3">{row.physicalStock ?? "-"}</td>
                    <td className="px-4 py-3">{row.difference ?? "-"}</td>
                    <td className="px-4 py-3">
                      {row.status === "valid" ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                          Valid
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-300">
                          {row.errors.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
