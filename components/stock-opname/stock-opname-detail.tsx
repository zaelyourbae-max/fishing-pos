"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function rupiah(amount: number) {
  return `Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

import StockOpnameApproveDialog from "@/components/stock-opname/stock-opname-approve-dialog";
import StockOpnameImportPanel from "@/components/stock-opname/stock-opname-import-panel";
import StockOpnameReviewTable, {
  type StockOpnameItemRow,
} from "@/components/stock-opname/stock-opname-review-table";
import StockOpnameStatusBadge from "@/components/stock-opname/stock-opname-status-badge";

type StockOpnameDetailData = {
  id: string;
  opnameNumber: string;
  status: "DRAFT" | "COUNTING" | "REVIEW" | "APPROVED" | "CANCELLED";
  title: string | null;
  notes: string | null;
  snapshotAt: string;
  createdAt: string;
  approvedAt: string | null;
  cancelledAt: string | null;
  createdBy: {
    name: string;
  };
  approvedBy: {
    name: string;
  } | null;
  cancelledBy: {
    name: string;
  } | null;
  items: StockOpnameItemRow[];
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StockOpnameDetail({
  session,
  canManage,
}: {
  session: StockOpnameDetailData;
  canManage: boolean;
}) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Panel nilai selisih dilipat default di HP; di desktop selalu terbuka.
  const [selisihOpen, setSelisihOpen] = useState(false);

  const stats = useMemo(() => {
    const counted = session.items.filter(
      (item) => item.physicalStock !== null,
    ).length;
    const totalDifference = session.items.reduce(
      (sum, item) => sum + (item.difference ?? 0),
      0,
    );
    const changedItems = session.items.filter(
      (item) => (item.difference ?? 0) !== 0,
    ).length;

    // Nilai selisih berdasarkan costPriceSnapshot
    const itemsWithDiff = session.items.filter((item) => (item.difference ?? 0) !== 0);
    const totalProdukSelisih = itemsWithDiff.length;

    const minusItems = itemsWithDiff.filter((item) => (item.difference ?? 0) < 0);
    const plusItems  = itemsWithDiff.filter((item) => (item.difference ?? 0) > 0);

    const totalQtyMinus   = minusItems.reduce((s, i) => s + (i.difference ?? 0), 0);
    const totalNilaiMinus = minusItems.reduce(
      (s, i) => s + (i.difference ?? 0) * i.costPriceSnapshot,
      0,
    );
    const totalQtyPlus   = plusItems.reduce((s, i) => s + (i.difference ?? 0), 0);
    const totalNilaiPlus = plusItems.reduce(
      (s, i) => s + (i.difference ?? 0) * i.costPriceSnapshot,
      0,
    );
    const netNilaiSelisih = totalNilaiMinus + totalNilaiPlus;

    const itemsWithZeroHpp = itemsWithDiff.filter(
      (item) => item.costPriceSnapshot === 0,
    ).length;

    return {
      total: session.items.length,
      counted,
      remaining: session.items.length - counted,
      totalDifference,
      changedItems,
      totalProdukSelisih,
      totalQtyMinus,
      totalNilaiMinus,
      totalQtyPlus,
      totalNilaiPlus,
      netNilaiSelisih,
      itemsWithZeroHpp,
    };
  }, [session.items]);

  const canEdit = session.status === "COUNTING";
  const canSubmitReview = canManage && session.status === "COUNTING";
  const canApprove = canManage && session.status === "REVIEW";
  const canCancel =
    canManage &&
    (session.status === "DRAFT" ||
      session.status === "COUNTING" ||
      session.status === "REVIEW");

  function refresh() {
    router.refresh();
  }

  async function postAction(action: "submit-review" | "approve" | "cancel") {
    setLoadingAction(action);
    setMessage("");
    setError("");

    const response = await fetch(`/api/stock-opnames/${session.id}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: action === "cancel" ? JSON.stringify({ reason: "Dibatalkan" }) : "{}",
    });
    const payload = await response.json();

    setLoadingAction("");

    if (!response.ok) {
      const staleCount =
        payload.details?.total && payload.details?.items
          ? payload.details.total
          : null;
      const staleInfo = staleCount
        ? ` ${staleCount} produk sudah berubah stoknya saat proses berjalan — muat ulang halaman dan coba lagi.`
        : "";
      setError(`${payload.message ?? "Aksi gagal."}${staleInfo}`);
      return;
    }

    setApproveOpen(false);
    setMessage(payload.message ?? "Aksi berhasil.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3">
            <StockOpnameStatusBadge status={session.status} />
          </div>
          <h1 className="page-title">{session.title || session.opnameNumber}</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {session.opnameNumber} / dibuat {formatDate(session.createdAt)} oleh{" "}
            {session.createdBy.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canSubmitReview ? (
            <button
              type="button"
              onClick={() => postAction("submit-review")}
              disabled={loadingAction !== "" || stats.remaining > 0}
              className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "submit-review" ? "Mengirim..." : "Submit Review"}
            </button>
          ) : null}
          {canApprove ? (
            <button
              type="button"
              onClick={() => setApproveOpen(true)}
              disabled={loadingAction !== ""}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Setujui Stock Opname
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={loadingAction !== ""}
              className="rounded-2xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              {loadingAction === "cancel" ? "Membatalkan..." : "Batalkan Sesi"}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total item", stats.total],
          ["Sudah dihitung", stats.counted],
          ["Belum dihitung", stats.remaining],
          ["Total selisih", stats.totalDifference],
        ].map(([label, value]) => (
          <div
            key={label}
            className="surface-panel rounded-3xl p-4 sm:p-5"
          >
            <div className="text-xs font-semibold uppercase text-slate-500">
              {label}
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {value}
            </div>
          </div>
        ))}
      </section>

      {/* Panel nilai selisih — tampil di REVIEW dan APPROVED */}
      {(session.status === "REVIEW" || session.status === "APPROVED") &&
        stats.totalProdukSelisih > 0 ? (
        <section className="surface-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelisihOpen((value) => !value)}
              className="flex flex-1 items-start justify-between gap-3 text-left sm:pointer-events-none"
              aria-expanded={selisihOpen}
            >
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Perkiraan Nilai Selisih
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Dihitung pakai harga modal saat opname dibuat ·{" "}
                  {stats.totalProdukSelisih} produk berbeda dari catatan
                </p>
                {!selisihOpen ? (
                  <p
                    className={`mt-2 text-sm font-bold sm:hidden ${
                      stats.netNilaiSelisih < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : stats.netNilaiSelisih > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {stats.netNilaiSelisih < 0
                      ? `Toko rugi ${rupiah(stats.netNilaiSelisih)}`
                      : stats.netNilaiSelisih > 0
                        ? `Toko untung ${rupiah(stats.netNilaiSelisih)}`
                        : "Stok pas, tidak ada selisih"}{" "}
                    · ketuk untuk lihat detail
                  </p>
                ) : null}
              </div>
              <span
                className={`mt-1 shrink-0 text-slate-400 transition-transform sm:hidden ${
                  selisihOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            {stats.itemsWithZeroHpp > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                ⚠ {stats.itemsWithZeroHpp} produk belum ada harga modal, nilainya belum dihitung
              </span>
            ) : null}
          </div>

          <div
            className={`gap-4 sm:grid sm:grid-cols-3 ${
              selisihOpen ? "grid" : "hidden"
            }`}
          >
            {/* Stok berkurang dari catatan */}
            <div className="flex flex-col rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                  ↓
                </span>
                <div>
                  <p className="text-base font-bold leading-tight text-rose-700 dark:text-rose-300">
                    Stok Hilang
                  </p>
                  <p className="text-xs text-rose-500/90 dark:text-rose-400/90">
                    Lebih sedikit dari catatan
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-rose-100 pt-3 dark:border-rose-500/20">
                <p className="text-2xl font-extrabold tabular-nums leading-none text-rose-700 dark:text-rose-300">
                  {Math.abs(stats.totalQtyMinus)}{" "}
                  <span className="text-sm font-semibold">barang</span>
                </p>
                <p className="mt-2 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  ≈ {rupiah(stats.totalNilaiMinus)}
                </p>
                <p className="mt-1 text-xs text-rose-500 dark:text-rose-500">
                  Perkiraan nilai barang hilang
                </p>
              </div>
            </div>

            {/* Stok lebih dari catatan */}
            <div className="flex flex-col rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                  ↑
                </span>
                <div>
                  <p className="text-base font-bold leading-tight text-emerald-700 dark:text-emerald-300">
                    Stok Lebih
                  </p>
                  <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90">
                    Lebih banyak dari catatan
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-emerald-100 pt-3 dark:border-emerald-500/20">
                <p className="text-2xl font-extrabold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
                  {stats.totalQtyPlus}{" "}
                  <span className="text-sm font-semibold">barang</span>
                </p>
                <p className="mt-2 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  ≈ {rupiah(stats.totalNilaiPlus)}
                </p>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
                  Perkiraan nilai barang lebih
                </p>
              </div>
            </div>

            {/* Selisih uang total */}
            <div
              className={`flex flex-col rounded-2xl border p-4 ${
                stats.netNilaiSelisih < 0
                  ? "border-rose-200 bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/15"
                  : stats.netNilaiSelisih > 0
                    ? "border-emerald-200 bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                    stats.netNilaiSelisih < 0
                      ? "bg-rose-200/70 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200"
                      : stats.netNilaiSelisih > 0
                        ? "bg-emerald-200/70 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  }`}
                >
                  =
                </span>
                <div>
                  <p className="text-base font-bold leading-tight text-slate-700 dark:text-slate-200">
                    Selisih Uang
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hilang &amp; lebih digabung
                  </p>
                </div>
              </div>
              <div
                className={`mt-3 border-t pt-3 ${
                  stats.netNilaiSelisih < 0
                    ? "border-rose-200 dark:border-rose-500/30"
                    : stats.netNilaiSelisih > 0
                      ? "border-emerald-200 dark:border-emerald-500/30"
                      : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <p
                  className={`text-2xl font-extrabold tabular-nums leading-none ${
                    stats.netNilaiSelisih < 0
                      ? "text-rose-700 dark:text-rose-300"
                      : stats.netNilaiSelisih > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {stats.netNilaiSelisih > 0 ? "+" : ""}
                  {stats.netNilaiSelisih === 0
                    ? "Rp 0"
                    : rupiah(stats.netNilaiSelisih)}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {stats.netNilaiSelisih < 0
                    ? "Toko rugi sebesar ini"
                    : stats.netNilaiSelisih > 0
                      ? "Toko untung sebesar ini"
                      : "Stok pas, tidak ada selisih"}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Panel Import Excel hanya relevan saat sesi masih dihitung (COUNTING).
          Setelah sesi final/selesai, panel ini disembunyikan. */}
      {canEdit ? (
        <StockOpnameImportPanel
          sessionId={session.id}
          canEdit={canEdit}
          onApplied={refresh}
        />
      ) : null}

      <StockOpnameReviewTable
        sessionId={session.id}
        items={session.items}
        canEdit={canEdit}
        onUpdated={refresh}
      />

      <StockOpnameApproveDialog
        open={approveOpen}
        loading={loadingAction === "approve"}
        totalItems={stats.total}
        changedItems={stats.changedItems}
        netNilaiSelisih={stats.netNilaiSelisih}
        itemsWithZeroHpp={stats.itemsWithZeroHpp}
        onClose={() => setApproveOpen(false)}
        onConfirm={() => postAction("approve")}
      />

      {cancelConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Batalkan sesi ini?
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Semua data hitungan dalam sesi ini akan hilang dan tidak bisa
              dikembalikan.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                disabled={loadingAction === "cancel"}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelConfirmOpen(false);
                  void postAction("cancel");
                }}
                disabled={loadingAction === "cancel"}
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Ya, Batalkan Sesi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
