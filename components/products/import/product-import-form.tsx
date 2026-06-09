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

type FilterStatus = "all" | "error" | "warning";

// ── Helpers ────────────────────────────────────────────────────────────────

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function statusClass(status: PreviewRow["status"]) {
  if (status === "error") {
    return "bg-rose-500/15 text-rose-300";
  }

  if (status === "warning") {
    return "bg-teal-500/10 text-teal-700 dark:text-teal-400";
  }

  return "bg-emerald-500/15 text-emerald-300";
}

function statusLabel(status: PreviewRow["status"]) {
  if (status === "error") return "Error";
  if (status === "warning") return "Perhatian";
  return "Siap";
}

function ActionBadge({ willUpdate }: { willUpdate: boolean }) {
  if (willUpdate) {
    return (
      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
        Update
      </span>
    );
  }

  return (
    <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300">
      Baru
    </span>
  );
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

// ── Main Component ─────────────────────────────────────────────────────────

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

  // R1 — filter state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const canImport = useMemo(
    () => Boolean(preview && preview.summary.errorRows === 0 && preview.rows.length > 0),
    [preview],
  );

  // R1 — filtered rows for preview table
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filterStatus === "all") return preview.rows;
    return preview.rows.filter((row) => row.status === filterStatus);
  }, [preview, filterStatus]);

  // R6 — count rows that will update existing products
  const updateCount = useMemo(
    () => (preview ? preview.rows.filter((row) => row.willUpdate).length : 0),
    [preview],
  );

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title">Import Produk</h1>
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
    setFilterStatus("all");

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
        </div>

        <div className="responsive-action-row grid-cols-2">
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
                setFilterStatus("all");
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-sm text-slate-900 outline-none dark:text-slate-100 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:contents">
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
        </div>

        {/* R6 — Warning jika ada produk yang akan di-update */}
        {preview && updateCount > 0 && !commitResult ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p className="font-semibold text-amber-100">
              ⚠️ {updateCount} produk yang sudah ada akan diperbarui
            </p>
            <p className="mt-1 text-amber-200/80">
              Data lama (harga, stok, kategori) akan ditimpa sesuai isi file Excel.
              Pastikan data di Excel sudah benar sebelum klik Import.
            </p>
          </div>
        ) : null}

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
          {/* Ringkasan */}
          <div className="grid gap-3 border-b border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-200 md:grid-cols-4">
            <div className="surface-panel-soft rounded-2xl p-4">
              Total produk: <b className="tabular-nums">{preview.summary.totalRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Siap import: <b className="tabular-nums">{preview.summary.validRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Perlu perhatian: <b className="tabular-nums">{preview.summary.warningRows}</b>
            </div>
            <div className="surface-panel-soft rounded-2xl p-4">
              Ada masalah: <b className="tabular-nums">{preview.summary.errorRows}</b>
            </div>
          </div>

          {/* R1 — Filter toggle */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Tampilkan:
            </span>
            {(
              [
                { value: "all", label: `Semua (${preview.summary.totalRows})` },
                { value: "error", label: `Ada masalah (${preview.summary.errorRows})` },
                { value: "warning", label: `Perlu perhatian (${preview.summary.warningRows})` },
              ] satisfies { value: FilterStatus; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterStatus(value)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  filterStatus === value
                    ? value === "error"
                      ? "bg-rose-500/20 text-rose-200"
                      : value === "warning"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-teal-600/20 text-teal-200"
                    : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
            {filterStatus !== "all" ? (
              <span className="ml-1 text-xs text-slate-500">
                — menampilkan {filteredRows.length} dari {preview.summary.totalRows} baris
              </span>
            ) : null}
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Tidak ada baris dengan status ini.
            </div>
          ) : null}

          {/* Desktop table */}
          {filteredRows.length > 0 ? (
            <div className="hidden lg:block">
              <div className="table-scroll">
                <table className="w-full min-w-[1550px] text-sm">
                  <thead>
                    <tr>
                      <th className="p-4 text-left">Row</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-left">Aksi</th>
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
                    {filteredRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-4 tabular-nums text-slate-300">{row.rowNumber}</td>
                        <td className="p-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        {/* R5 — Badge Baru/Update */}
                        <td className="p-4">
                          <ActionBadge willUpdate={row.willUpdate} />
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
                        {/* R4 — Format Rupiah */}
                        <td className="p-4 text-right tabular-nums text-slate-300">
                          {rupiah(row.costPrice)}
                        </td>
                        <td className="p-4 text-right tabular-nums text-slate-300">
                          {rupiah(row.sellPrice)}
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
          ) : null}

          {/* Mobile cards */}
          {filteredRows.length > 0 ? (
            <div className="mobile-card-list lg:hidden">
              {filteredRows.map((row) => (
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
                    <div className="flex flex-wrap gap-2">
                      {/* R5 — Badge Baru/Update di mobile */}
                      <ActionBadge willUpdate={row.willUpdate} />
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </div>
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
                    {/* R4 — Format Rupiah di mobile */}
                    <p>
                      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Modal/HPP
                      </span>
                      <span className="font-semibold tabular-nums">
                        {rupiah(row.costPrice)}
                      </span>
                    </p>
                    <p>
                      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Harga Jual
                      </span>
                      <span className="font-semibold tabular-nums">
                        {rupiah(row.sellPrice)}
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
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
