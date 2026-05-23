"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type PreviewRow = {
  rowNumber: number;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  type: string;
  size: string;
  variant: string;
  supplier: string;
  rackLocation: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
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

function ValidationNotes({ row }: { row: PreviewRow }) {
  if (row.errors.length === 0 && row.warnings.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className="space-y-2">
      {row.errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-rose-300">
          {row.errors.map((entry) => (
            <li key={`${row.rowNumber}-error-${entry}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
      {row.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-amber-200">
          {row.warnings.map((entry) => (
            <li key={`${row.rowNumber}-warning-${entry}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ProductImportForm() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title">Import Produk</h1>
            <p className="mt-3 text-slate-400">
              Upload Excel produk, preview validasi, lalu import ke PostgreSQL.
            </p>
          </div>
        </div>
        <section className="surface-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Memuat form import...
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <div className="h-14 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            <div className="h-14 rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
            <div className="h-14 rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
          </div>
        </section>
      </div>
    );
  }

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

        <div className="responsive-action-row">
          <Link
            href="/api/products/import/template"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Download Template
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Kembali
          </Link>
        </div>
      </div>

      <section className="surface-panel rounded-3xl p-5 sm:p-6">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-medium text-slate-800 dark:text-slate-100">Petunjuk cepat import:</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Kolom wajib: <code>name</code>, <code>category</code>, <code>unit</code>, <code>costPrice</code>, <code>sellPrice</code>, <code>stock</code>, <code>minStock</code>.</li>
            <li><code>sku</code> boleh kosong (akan auto-generate), <code>barcode</code> boleh kosong.</li>
            <li>Gunakan nilai biasa, jangan formula Excel.</li>
          </ul>
        </div>
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

          <div className="hidden lg:block">
          <div className="table-scroll">
            <table className="w-full min-w-[1450px] text-sm">
              <thead>
                <tr>
                  <th className="p-4 text-left">Row</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">SKU</th>
                  <th className="p-4 text-left">Barcode</th>
                  <th className="p-4 text-left">Nama</th>
                  <th className="p-4 text-left">Kategori</th>
                  <th className="p-4 text-left">Brand / Type</th>
                  <th className="p-4 text-left">Size / Variant</th>
                  <th className="p-4 text-left">Supplier</th>
                  <th className="p-4 text-left">Lokasi Rak</th>
                  <th className="p-4 text-left">Unit</th>
                  <th className="p-4 text-right">Modal/HPP</th>
                  <th className="p-4 text-right">Harga Jual</th>
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
                    <td className="p-4 text-slate-700 dark:text-white">{row.sku || "Auto"}</td>
                    <td className="p-4 text-slate-300">{row.barcode || "-"}</td>
                    <td className="p-4 font-semibold text-slate-950 dark:text-white">{row.name || "-"}</td>
                    <td className="p-4 text-slate-300">{row.category || "-"}</td>
                    <td className="p-4 text-slate-300">
                      {[row.brand, row.type].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="p-4 text-slate-300">
                      {[row.size, row.variant].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="p-4 text-slate-300">{row.supplier || "-"}</td>
                    <td className="p-4 text-slate-300">{row.rackLocation || "-"}</td>
                    <td className="p-4 text-slate-300">{row.unit || "-"}</td>
                    <td className="p-4 text-right tabular-nums text-slate-300">
                      {row.costPrice.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-300">
                      {row.sellPrice.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-300">{row.stock}</td>
                    <td className="max-w-sm p-4 text-slate-300">
                      <ValidationNotes row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          <div className="mobile-card-list lg:hidden">
            {preview.rows.map((row) => (
              <article key={row.rowNumber} className="mobile-data-card">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Row {row.rowNumber}
                    </p>
                    <p className="mt-1 break-words text-base font-semibold text-slate-950 dark:text-white">
                      {row.name || "-"}
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                      SKU: {row.sku || "Auto"}
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                      Barcode: {row.barcode || "-"}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      row.status,
                    )}`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  <p className="min-w-0">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Kategori
                    </span>
                    <span className="break-words">{row.category || "-"}</span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Unit
                    </span>
                    <span className="break-words">{row.unit || "-"}</span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Supplier
                    </span>
                    <span className="break-words">{row.supplier || "-"}</span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Lokasi Rak
                    </span>
                    <span className="break-words">{row.rackLocation || "-"}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Modal/HPP
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.costPrice.toLocaleString("id-ID")}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Harga Jual
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.sellPrice.toLocaleString("id-ID")}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Stok
                    </span>
                    <span className="font-semibold tabular-nums">{row.stock}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Min Stok
                    </span>
                    <span className="font-semibold tabular-nums">{row.minStock}</span>
                  </p>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <ValidationNotes row={row} />
                </div>
              </article>
            ))}
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
