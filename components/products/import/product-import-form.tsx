"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PreviewRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  notes: string;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  willUpdate: boolean;
};

type PreviewData = {
  rows: PreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
  };
};

type CommitResult = {
  total: number;
  created: number;
  updated: number;
};

function statusClass(status: PreviewRow["status"]) {
  if (status === "error") {
    return "bg-rose-500/15 text-rose-300";
  }

  if (status === "warning") {
    return "bg-teal-500/10 text-teal-700 dark:text-teal-400";
  }

  return "bg-emerald-500/15 text-emerald-300";
}

export default function ProductImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const canImport = useMemo(
    () => Boolean(preview && preview.summary.errorRows === 0 && preview.rows.length > 0),
    [preview],
  );

  async function handlePreview() {
    if (!file) {
      setError("Pilih file .xlsx terlebih dahulu.");
      return;
    }

    setLoadingPreview(true);
    setError("");
    setMessage("");
    setCommitResult(null);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/products/import/preview", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setLoadingPreview(false);

    if (!response.ok) {
      setPreview(null);
      setError(payload.message ?? "Gagal preview file Excel.");
      return;
    }

    setPreview(payload.data);
    setMessage("Preview berhasil dibuat. Periksa status row sebelum import.");
  }

  async function handleCommit() {
    if (!preview) {
      return;
    }

    setLoadingCommit(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/products/import/commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: preview.rows,
      }),
    });
    const payload = await response.json();

    setLoadingCommit(false);

    if (!response.ok) {
      setError(payload.message ?? "Import produk gagal.");
      return;
    }

    setCommitResult(payload.data);
    setMessage("Import produk berhasil disimpan ke database.");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Import Produk</h1>
          <p className="mt-3 text-slate-400">
            Upload Excel produk, preview validasi, lalu import ke PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/api/products/import/template"
            prefetch={false}
            className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Download Template
          </Link>
          <Link
            href="/products"
            className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Kembali
          </Link>
        </div>
      </div>

      <section className="surface-panel rounded-3xl p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium text-slate-300">
              File Excel .xlsx
            </label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setCommitResult(null);
                setMessage("");
                setError("");
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-sm text-slate-900 outline-none dark:text-slate-100 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />
          </div>

          <button
            type="button"
            onClick={handlePreview}
            disabled={loadingPreview}
            className="rounded-2xl border border-teal-300 px-6 py-4 text-sm font-semibold text-teal-200 hover:bg-teal-600/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPreview ? "Memproses..." : "Preview"}
          </button>

          <button
            type="button"
            onClick={handleCommit}
            disabled={!canImport || loadingCommit}
            className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-semibold text-white hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingCommit ? "Import..." : "Import"}
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}
        {commitResult ? (
          <div className="mt-5 grid gap-3 text-sm text-slate-200 md:grid-cols-3">
            <div className="surface-panel-soft rounded-2xl p-4">
              Total: <b className="tabular-nums">{commitResult.total}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Baru: <b className="tabular-nums">{commitResult.created}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Update: <b className="tabular-nums">{commitResult.updated}</b>
            </div>
          </div>
        ) : null}
      </section>

      {preview ? (
        <section className="surface-panel rounded-3xl">
          <div className="grid gap-3 border-b border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-200 md:grid-cols-4">
            <div className="surface-panel-soft rounded-2xl p-4">
              Total row: <b className="tabular-nums">{preview.summary.totalRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Valid: <b className="tabular-nums">{preview.summary.validRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Warning: <b className="tabular-nums">{preview.summary.warningRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Error: <b className="tabular-nums">{preview.summary.errorRows}</b>
            </div>
          </div>

          <div className="table-scroll">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-[#060B1F] text-slate-400">
                <tr>
                  <th className="p-4 text-left">Row</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">SKU</th>
                  <th className="p-4 text-left">Nama</th>
                  <th className="p-4 text-left">Kategori</th>
                  <th className="p-4 text-left">Supplier</th>
                  <th className="p-4 text-right">Beli</th>
                  <th className="p-4 text-right">Jual</th>
                  <th className="p-4 text-right">Stok</th>
                  <th className="p-4 text-left">Catatan Validasi</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-4 tabular-nums text-slate-300">{row.rowNumber}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          row.status,
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-white">{row.sku || "Auto"}</td>
                    <td className="p-4 font-semibold text-white">{row.name || "-"}</td>
                    <td className="p-4 text-slate-300">{row.category || "-"}</td>
                    <td className="p-4 text-slate-300">{row.supplier || "-"}</td>
                    <td className="p-4 text-right tabular-nums text-slate-300">
                      {row.costPrice.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-300">
                      {row.sellPrice.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-300">{row.stock}</td>
                    <td className="max-w-sm p-4 text-slate-300">
                      {[...row.errors, ...row.warnings].join("; ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-sm text-slate-400">
          Belum ada preview. Download template, isi data produk, lalu upload file
          .xlsx.
        </div>
      )}
    </div>
  );
}
