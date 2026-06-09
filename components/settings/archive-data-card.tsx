"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { formatDateID } from "@/lib/date-format";

type ArchivePreview = {
  thresholdDate: string;
  ageYears: number;
  eligibleCount: number;
  oldestDate: string | null;
  newestDate: string | null;
  grossValue: number;
};

type ArchiveStats = {
  archivedCount: number;
  archivedGrossValue: number;
  exportedCount: number;
  notExportedCount: number;
};

type ArchiveDataCardProps = {
  initialPreview: ArchivePreview;
  initialStats: ArchiveStats;
};

function rupiah(amount: number) {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function ArchiveDataCard({
  initialPreview,
  initialStats,
}: ArchiveDataCardProps) {
  const router = useRouter();
  const [preview, setPreview] = useState(initialPreview);
  const [stats, setStats] = useState(initialStats);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasEligible = preview.eligibleCount > 0;
  const hasArchived = stats.archivedCount > 0;
  const hasDeletable = stats.exportedCount > 0;
  const busy = working || exporting || deleting;

  async function refreshStatus() {
    try {
      const response = await fetch("/api/archive");
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.data) {
        setPreview(payload.data.preview);
        setStats(payload.data.stats);
      }
    } catch {
      // diabaikan: refresh status bersifat opsional.
    }
  }

  async function runArchive() {
    setWorking(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/archive", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal mengarsipkan data.");
      }

      const archived = payload.data?.archived ?? 0;
      setPreview(payload.data.preview);
      setStats(payload.data.stats);
      setMessage(
        archived > 0
          ? `Berhasil. ${archived.toLocaleString("id-ID")} transaksi lama dipindah ke arsip. Tidak ada angka laporan yang berubah.`
          : "Tidak ada transaksi yang perlu diarsipkan saat ini.",
      );
      router.refresh();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Gagal mengarsipkan data.",
      );
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  }

  async function runExport() {
    setExporting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/archive/export", { method: "POST" });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? "Gagal mengekspor arsip.");
      }

      // Unduh file Excel yang dikirim server.
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "arsip-transaksi.xlsx";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      await refreshStatus();
      setMessage(
        "Arsip berhasil diekspor & terunduh. Sekarang arsip aman untuk dihapus permanen bila Anda mau.",
      );
      router.refresh();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Gagal mengekspor arsip.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function runDelete() {
    setDeleting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/archive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal menghapus arsip.");
      }

      const deleted = payload.data?.deleted ?? 0;
      setPreview(payload.data.preview);
      setStats(payload.data.stats);
      setMessage(
        `${deleted.toLocaleString("id-ID")} transaksi arsip dihapus permanen. Status loyalty & total belanja pelanggan tetap dijaga utuh.`,
      );
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus arsip.",
      );
    } finally {
      setDeleting(false);
      setDeleteConfirming(false);
    }
  }

  return (
    <section className="surface-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
          <Archive className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            Arsip Data Transaksi
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Rapikan transaksi lama (lebih dari {preview.ageYears} tahun) ke
            gudang arsip supaya sistem tetap ringan & aman jangka panjang.
          </p>
        </div>
      </div>

      {/* Jaminan keamanan — disampaikan eksplisit agar owner tenang. */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Aman.</span> Mengarsipkan{" "}
          <span className="font-semibold">tidak menghapus apa pun</span> dan{" "}
          <span className="font-semibold">tidak mengubah angka laporan</span>.
          Data hanya dipindah ke arsip. Menghapus permanen baru bisa dilakukan
          nanti, itu pun setelah diekspor lebih dulu.
        </p>
      </div>

      {/* Pratinjau: apa yang akan diarsip bila ditekan sekarang. */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Siap diarsipkan sekarang
        </p>
        {hasEligible ? (
          <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <p>
              <span className="text-2xl font-bold text-slate-950 dark:text-white">
                {preview.eligibleCount.toLocaleString("id-ID")}
              </span>{" "}
              transaksi
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Rentang: {formatDateID(preview.oldestDate)} —{" "}
              {formatDateID(preview.newestDate)}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Total nilai: {rupiah(preview.grossValue)}
            </p>
            <p className="text-xs text-slate-400">
              (Semua transaksi sebelum {formatDateID(preview.thresholdDate)})
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Belum ada transaksi yang berumur lebih dari {preview.ageYears} tahun.
            Tidak ada yang perlu dirapikan.
          </p>
        )}
      </div>

      {/* Status arsip saat ini. */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Di arsip</p>
          <p className="text-lg font-bold text-slate-950 dark:text-white">
            {stats.archivedCount.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sudah diekspor
          </p>
          <p className="text-lg font-bold text-slate-950 dark:text-white">
            {stats.exportedCount.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Belum diekspor
          </p>
          <p className="text-lg font-bold text-slate-950 dark:text-white">
            {stats.notExportedCount.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {message ? (
        <p className="mt-3 text-sm font-semibold text-teal-700 dark:text-teal-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* Aksi. Konfirmasi dua langkah untuk arsip & penghapusan. */}
      {confirming ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Arsipkan {preview.eligibleCount.toLocaleString("id-ID")} transaksi
            lama?
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
            Data tidak dihapus, hanya dipindah ke arsip. Bisa dikeluarkan lagi
            bila perlu.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={runArchive}
              disabled={working}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {working ? "Mengarsipkan..." : "Ya, arsipkan"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={working}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
          </div>
        </div>
      ) : deleteConfirming ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/25 dark:bg-rose-500/5">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            Hapus permanen {stats.exportedCount.toLocaleString("id-ID")}{" "}
            transaksi arsip?
          </p>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-300/80">
            Tindakan ini <span className="font-bold">tidak bisa dibatalkan</span>
            . Pastikan file ekspor sudah Anda simpan. Status loyalty & total
            belanja pelanggan tetap dijaga (tidak ikut hilang).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={runDelete}
              disabled={deleting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {deleting ? "Menghapus..." : "Ya, hapus permanen"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirming(false)}
              disabled={deleting}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setError("");
              setConfirming(true);
            }}
            disabled={!hasEligible || busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Archive className="h-4 w-4" />
            Arsipkan transaksi lama
          </button>

          {hasArchived ? (
            <button
              type="button"
              onClick={runExport}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-300 bg-sky-50 px-5 text-sm font-bold text-sky-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-sky-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
            >
              {exporting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Mengekspor..." : "Ekspor arsip (Excel)"}
            </button>
          ) : null}

          {hasDeletable ? (
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
                setDeleteConfirming(true);
              }}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-5 text-sm font-bold text-rose-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Hapus permanen ({stats.exportedCount.toLocaleString("id-ID")})
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
