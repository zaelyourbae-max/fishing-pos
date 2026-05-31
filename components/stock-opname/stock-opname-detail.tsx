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

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Total item", stats.total],
          ["Sudah dihitung", stats.counted],
          ["Belum dihitung", stats.remaining],
          ["Total selisih", stats.totalDifference],
        ].map(([label, value]) => (
          <div
            key={label}
            className="surface-panel rounded-3xl p-5"
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Estimasi Nilai Selisih
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Berdasarkan HPP (cost price) saat sesi dibuat ·{" "}
                {stats.totalProdukSelisih} produk selisih
              </p>
            </div>
            {stats.itemsWithZeroHpp > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                ⚠ {stats.itemsWithZeroHpp} produk HPP = 0, nilai tidak dihitung
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Minus */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">
                Selisih Minus (kurang)
              </p>
              <p className="mt-2 text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {stats.totalQtyMinus} pcs
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {rupiah(stats.totalNilaiMinus)}
              </p>
              <p className="mt-0.5 text-[11px] text-rose-400 dark:text-rose-500">
                Estimasi kerugian HPP
              </p>
            </div>

            {/* Plus */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Selisih Plus (lebih)
              </p>
              <p className="mt-2 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                +{stats.totalQtyPlus} pcs
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{rupiah(stats.totalNilaiPlus)}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-500 dark:text-emerald-600">
                Estimasi surplus HPP
              </p>
            </div>

            {/* Net */}
            <div
              className={`rounded-2xl border p-4 ${
                stats.netNilaiSelisih < 0
                  ? "border-rose-200 bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/15"
                  : stats.netNilaiSelisih > 0
                    ? "border-emerald-200 bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Net Nilai Selisih
              </p>
              <p
                className={`mt-2 text-xl font-bold tabular-nums ${
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
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                Minus + Plus (estimasi HPP)
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <StockOpnameImportPanel
        sessionId={session.id}
        canEdit={canEdit}
        onApplied={refresh}
      />

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
