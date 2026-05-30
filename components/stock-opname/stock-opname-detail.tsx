"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

    return {
      total: session.items.length,
      counted,
      remaining: session.items.length - counted,
      totalDifference,
      changedItems,
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
