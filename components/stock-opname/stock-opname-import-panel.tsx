"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const PREVIEW_PAGE_SIZE = 10;

// Jendela maksimal 5 nomor halaman, sama seperti pagination di Produk.
function visiblePages(currentPage: number, pageCount: number) {
  const maxVisible = 5;

  if (pageCount <= maxVisible) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, pageCount - maxVisible + 1));

  return Array.from({ length: maxVisible }, (_, index) => start + index);
}

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
    wrongSessionRows: number;
    missingPhysicalRows: number;
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
  // Panel import dilipat default di HP; di desktop selalu terbuka.
  const [panelOpen, setPanelOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

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
    setPreviewPage(1);
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

  // Deteksi kasus paling umum agar bisa memberi pesan ramah, bukan tabel error.
  const summary = preview?.summary;
  const allWrongSession = Boolean(
    summary && summary.totalRows > 0 && summary.wrongSessionRows === summary.totalRows,
  );
  const onlyMissingPhysical = Boolean(
    summary &&
      summary.errorRows > 0 &&
      summary.wrongSessionRows === 0 &&
      summary.errorRows === summary.missingPhysicalRows,
  );
  const allReady = Boolean(summary && summary.errorRows === 0 && summary.totalRows > 0);

  // Paginasi baris preview (10 per halaman) — gaya sama seperti di Produk.
  const previewRows = preview?.rows ?? [];
  const previewPageCount = Math.max(
    1,
    Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE),
  );
  const safePreviewPage = Math.min(Math.max(previewPage, 1), previewPageCount);
  const previewFrom =
    previewRows.length === 0 ? 0 : (safePreviewPage - 1) * PREVIEW_PAGE_SIZE + 1;
  const previewTo = Math.min(safePreviewPage * PREVIEW_PAGE_SIZE, previewRows.length);
  const pagedPreviewRows = previewRows.slice(
    (safePreviewPage - 1) * PREVIEW_PAGE_SIZE,
    safePreviewPage * PREVIEW_PAGE_SIZE,
  );

  return (
    <section className="surface-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          className="flex flex-1 items-center justify-between gap-3 text-left sm:pointer-events-none"
          aria-expanded={panelOpen}
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Import Excel
          </h2>
          <span
            className={`shrink-0 text-slate-400 transition-transform sm:hidden ${
              panelOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <a
          href={`/api/stock-opnames/${sessionId}/template`}
          className={`rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 sm:inline-flex ${
            panelOpen ? "inline-flex" : "hidden"
          }`}
        >
          Download Template
        </a>
      </div>

      <div className={`${panelOpen ? "block" : "hidden"} sm:block`}>
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
        <div className="grid grid-cols-2 gap-3 lg:contents">
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
        <div className="mt-5 space-y-4">
          {/* Pesan ramah sesuai kondisi paling umum */}
          {allWrongSession ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                File ini sepertinya dari sesi Stock Opname yang berbeda
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-200/80">
                Klik <b>Download Template</b> di sesi ini, isi kolom stok fisik,
                lalu upload file itu kembali. Jangan pakai template dari sesi lain.
              </p>
            </div>
          ) : onlyMissingPhysical ? (
            <div className="rounded-2xl border border-teal-300 bg-teal-50 p-4 text-sm dark:border-teal-500/30 dark:bg-teal-500/10">
              <p className="font-semibold text-teal-800 dark:text-teal-200">
                Stok fisik belum diisi
              </p>
              <p className="mt-1 text-teal-700 dark:text-teal-200/80">
                Buka file Excel, isi jumlah hasil hitung di kolom{" "}
                <b>physicalStock</b> (angka bulat), simpan, lalu upload lagi.
              </p>
            </div>
          ) : allReady ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                Semua {preview.summary.totalRows} baris siap diimpor
              </p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-200/80">
                Periksa sekilas data di bawah, lalu klik <b>Apply Import</b>.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="font-semibold text-rose-800 dark:text-rose-200">
                Ada {preview.summary.errorRows} baris yang perlu diperbaiki
              </p>
              <p className="mt-1 text-rose-700 dark:text-rose-200/80">
                Perbaiki baris bertanda merah di file Excel, simpan, lalu upload
                lagi. Tombol Apply baru aktif jika tidak ada baris bermasalah.
              </p>
            </div>
          )}

          {/* Ringkasan angka */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm sm:gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total baris</p>
              <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {preview.summary.totalRows}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Siap</p>
              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {preview.summary.validRows}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-xs text-rose-700 dark:text-rose-300">Bermasalah</p>
              <p className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {preview.summary.errorRows}
              </p>
            </div>
          </div>

          {/* Tabel detail — desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 sm:block">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Sistem</th>
                    <th className="px-4 py-3">Fisik</th>
                    <th className="px-4 py-3">Selisih</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pagedPreviewRows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.itemId}`}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.name}
                        </span>
                        {row.sku ? (
                          <span className="block text-slate-400">{row.sku}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.systemStock ?? "-"}</td>
                      <td className="px-4 py-3 tabular-nums">{row.physicalStock ?? "-"}</td>
                      <td className="px-4 py-3 tabular-nums">{row.difference ?? "-"}</td>
                      <td className="px-4 py-3">
                        {row.status === "valid" ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                            Siap
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-300">
                            {row.errors.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kartu detail — HP */}
          <div className="space-y-3 sm:hidden">
            {pagedPreviewRows.map((row) => (
              <div
                key={`${row.rowNumber}-${row.itemId}`}
                className={`rounded-2xl border p-3 ${
                  row.status === "valid"
                    ? "border-slate-200 dark:border-slate-800"
                    : "border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {row.name}
                    </p>
                    {row.sku ? (
                      <p className="truncate text-xs text-slate-400">{row.sku}</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.status === "valid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    }`}
                  >
                    {row.status === "valid" ? "Siap" : "Bermasalah"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sistem</p>
                    <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {row.systemStock ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fisik</p>
                    <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {row.physicalStock ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Selisih</p>
                    <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {row.difference ?? "-"}
                    </p>
                  </div>
                </div>
                {row.status === "error" ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-rose-600 dark:text-rose-300">
                    {row.errors.map((entry) => (
                      <li key={`${row.rowNumber}-${entry}`}>{entry}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>

          {/* Paginasi baris preview — gaya sama seperti di Produk */}
          {previewPageCount > 1 ? (
            <div className="flex flex-col gap-2.5 border-t border-slate-200 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Menampilkan {previewFrom} - {previewTo} dari {previewRows.length} baris
              </p>
              <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPage(Math.max(1, safePreviewPage - 1))}
                  disabled={safePreviewPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {visiblePages(safePreviewPage, previewPageCount).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPreviewPage(pageNumber)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm ${
                      pageNumber === safePreviewPage
                        ? "border-teal-200 bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                        : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setPreviewPage(Math.min(previewPageCount, safePreviewPage + 1))
                  }
                  disabled={safePreviewPage === previewPageCount}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
    </section>
  );
}
