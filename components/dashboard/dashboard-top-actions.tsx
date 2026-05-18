"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  Download,
  LockKeyhole,
  RefreshCw,
  Save,
  CheckCircle2,
  X,
} from "lucide-react";

type PaymentClosingRow = {
  method: string;
  total: string;
};

type DashboardTopActionsProps = {
  selectedDateInput: string;
  selectedDateLabel: string;
  cashAmount: string;
  cashValue: number;
  grossOmzet: string;
  returnValue: string;
  transactionCount: number;
  notificationCount: number;
  payments: PaymentClosingRow[];
  closedBy: string;
};

type DashboardStatusChipsProps = {
  selectedDateInput: string;
  selectedDateLabel: string;
  userName: string;
  role: string;
  lowStockCount: number;
};

type ClosingStatus = "OPEN" | "CLOSED" | "REOPENED";

type ClosingRecord = {
  id: string;
  date: string;
  status: ClosingStatus;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes: string;
  grossOmzet: number;
  netOmzet: number;
  transactionCount: number;
  paymentSummary: PaymentClosingRow[];
  returnValue: number;
  closedBy: string | null;
  closedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  logs: {
    id: string;
    action: string;
    reason: string | null;
    note: string | null;
    createdAt: string;
    userName: string | null;
  }[];
};

export default function DashboardTopActions({
  selectedDateInput,
  selectedDateLabel,
  cashAmount,
  cashValue,
  grossOmzet,
  returnValue,
  transactionCount,
  notificationCount,
  payments,
  closedBy,
}: DashboardTopActionsProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const { closing, status, refresh } = useClosingRecord(selectedDateInput);
  const isClosed = status === "CLOSED";

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        <div className="relative flex justify-end lg:order-last">
          <button
            type="button"
            onClick={() => setNotificationOpen((open) => !open)}
            aria-expanded={notificationOpen}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-blue-500/10"
            title="Buka notifikasi"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            ) : null}
          </button>
          {notificationOpen ? (
            <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                Notifikasi Dashboard
              </p>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                  Periksa stok rendah dan retur hari ini.
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                  {notificationCount > 0
                    ? `${notificationCount} item dashboard perlu diperiksa.`
                    : "Belum ada notifikasi prioritas."}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <form className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-auto">
          <label className="relative min-w-0">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="date"
              name="date"
              defaultValue={selectedDateInput}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-52 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:ring-blue-500/10"
              title="Pilih tanggal dashboard"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-500/60"
          >
            Terapkan
          </button>
        </form>

        <a
          href={`/dashboard?date=${selectedDateInput}`}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-500/60"
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
        >
          <RefreshCw className="h-4 w-4" />
        </a>

        <a
          href="/api/reports/export/pdf"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-slate-900"
          title="Export PDF"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </a>

        <button
          type="button"
          onClick={() => setClosingOpen(true)}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 active:scale-95 ${
            isClosed ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={isClosed ? "Lihat closing hari ini" : "Mulai closing hari ini"}
        >
          {isClosed ? <CheckCircle2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {isClosed ? "Lihat Closing" : "Closing Hari Ini"}
        </button>
      </div>

      {closingOpen ? (
        <ClosingDialog
          selectedDateInput={selectedDateInput}
          selectedDateLabel={selectedDateLabel}
          cashAmount={cashAmount}
          cashValue={cashValue}
          grossOmzet={grossOmzet}
          returnValue={returnValue}
          transactionCount={transactionCount}
          payments={payments}
          closedBy={closedBy}
          existingClosing={closing}
          closingStatus={status}
          onChanged={refresh}
          onClose={() => setClosingOpen(false)}
        />
      ) : null}
    </>
  );
}

export function DashboardStatusChips({
  selectedDateInput,
  selectedDateLabel,
  userName,
  role,
  lowStockCount,
}: DashboardStatusChipsProps) {
  const { closing, status } = useClosingRecord(selectedDateInput);
  const roleLabel =
    role === "cashier"
      ? `Kasir: ${userName}`
      : role === "developer"
        ? `Login sebagai Developer`
        : `Owner: ${userName}`;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-teal-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-teal-200">
        <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
        Login Aktif
        <span className="font-medium text-slate-500">{roleLabel}</span>
      </span>
      <span
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm dark:border-slate-800 dark:bg-slate-950/70 ${
          status === "CLOSED"
            ? "border-teal-200 bg-white text-teal-700"
            : status === "REOPENED"
              ? "border-blue-200 bg-white text-blue-700"
              : "border-slate-200 bg-white text-amber-700"
        }`}
      >
        {status === "CLOSED"
          ? "✓ Sudah Closing"
          : status === "REOPENED"
            ? "Reopened"
            : "Belum Closing"}
        <span className="font-medium text-slate-500">
          {status === "CLOSED" && closing?.closedAt
            ? `${selectedDateLabel} • ${formatTime(closing.closedAt)}`
            : selectedDateLabel}
        </span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-rose-200">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-50 px-1 dark:bg-rose-500/15">
          {lowStockCount}
        </span>
        Stok Rendah
      </span>
    </div>
  );
}

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatSignedRupiah(value: number) {
  if (value > 0) {
    return `+${formatRupiah(value)}`;
  }

  if (value < 0) {
    return `-${formatRupiah(Math.abs(value))}`;
  }

  return formatRupiah(0);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function useClosingRecord(date: string) {
  const [closing, setClosing] = useState<ClosingRecord | null>(null);
  const [status, setStatus] = useState<ClosingStatus>("OPEN");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const response = await fetch(`/api/closings?date=${date}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("CLOSING_FETCH_FAILED");
        }

        const payload = await response.json();
        const data = payload.data ?? {};

        if (cancelled) {
          return;
        }

        setStatus((data.status ?? "OPEN") as ClosingStatus);
        setClosing(data.closing ? normalizeClosing(data.closing) : null);
      } catch {
        if (!cancelled) {
          setStatus("OPEN");
          setClosing(null);
        }
      }
    }

    sync();

    return () => {
      cancelled = true;
    };
  }, [date, version]);

  return {
    closing,
    status,
    refresh: () => setVersion((current) => current + 1),
  };
}

function objectValue(value: unknown, key: string) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function normalizeClosing(raw: unknown): ClosingRecord {
  const closedBy = objectValue(raw, "closed_by");
  const reopenedBy = objectValue(raw, "reopened_by");
  const paymentSummary = objectValue(raw, "payment_summary");
  const logs = objectValue(raw, "logs");

  return {
    id: String(objectValue(raw, "id") ?? ""),
    date: String(
      objectValue(raw, "closing_date") ?? objectValue(raw, "date") ?? "",
    ),
    status: String(objectValue(raw, "status") ?? "OPEN") as ClosingStatus,
    expectedCash: numberValue(objectValue(raw, "expected_cash")),
    actualCash: numberValue(objectValue(raw, "actual_cash")),
    difference: numberValue(objectValue(raw, "difference")),
    notes: stringValue(objectValue(raw, "notes")),
    grossOmzet: numberValue(objectValue(raw, "gross_omzet")),
    netOmzet: numberValue(objectValue(raw, "net_omzet")),
    transactionCount: numberValue(objectValue(raw, "transaction_count")),
    paymentSummary: Array.isArray(paymentSummary)
      ? paymentSummary.map((item) => ({
          method: String(objectValue(item, "method") ?? "-"),
          total: formatRupiah(numberValue(objectValue(item, "total"))),
        }))
      : [],
    returnValue: numberValue(objectValue(raw, "return_value")),
    closedBy: stringValue(objectValue(closedBy, "name")) || null,
    closedAt: stringValue(objectValue(raw, "closed_at")) || null,
    reopenedBy: stringValue(objectValue(reopenedBy, "name")) || null,
    reopenedAt: stringValue(objectValue(raw, "reopened_at")) || null,
    reopenReason: stringValue(objectValue(raw, "reopen_reason")) || null,
    logs: Array.isArray(logs)
      ? logs.map((log) => {
          const user = objectValue(log, "user");

          return {
            id: String(objectValue(log, "id") ?? ""),
            action: String(objectValue(log, "action") ?? ""),
            reason: stringValue(objectValue(log, "reason")) || null,
            note: stringValue(objectValue(log, "note")) || null,
            createdAt: String(objectValue(log, "created_at") ?? ""),
            userName: stringValue(objectValue(user, "name")) || null,
          };
        })
      : [],
  };
}

function ClosingDialog({
  selectedDateInput,
  selectedDateLabel,
  cashAmount,
  cashValue,
  grossOmzet,
  returnValue,
  transactionCount,
  payments,
  closedBy,
  existingClosing,
  closingStatus,
  onChanged,
  onClose,
}: Omit<DashboardTopActionsProps, "notificationCount"> & {
  existingClosing: ClosingRecord | null;
  closingStatus: ClosingStatus;
  onChanged: () => void;
  onClose: () => void;
}) {
  const isClosed = closingStatus === "CLOSED";
  const [step, setStep] = useState(isClosed ? 4 : 1);
  const [actualCash, setActualCash] = useState(
    isClosed && existingClosing ? String(existingClosing.actualCash) : "",
  );
  const [notes, setNotes] = useState(isClosed ? (existingClosing?.notes ?? "") : "");
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [error, setError] = useState("");
  const [savedClosing, setSavedClosing] = useState<ClosingRecord | null>(null);
  const actualCashInput = actualCash.trim();
  const actualCashFilled = actualCashInput !== "";
  const actualValue = Number(actualCashInput);
  const actualCashValid =
    actualCashFilled && /^\d+$/.test(actualCashInput) && Number.isFinite(actualValue);
  const difference = actualCashValid ? actualValue - cashValue : 0;
  const differenceLabel = formatSignedRupiah(difference);

  const paymentMap = useMemo(() => {
    const map = new Map(payments.map((payment) => [payment.method.toUpperCase(), payment.total]));

    return {
      cash: map.get("CASH") ?? cashAmount,
      qris: map.get("QRIS") ?? "Rp 0",
      transfer: map.get("TRANSFER") ?? map.get("BANK_TRANSFER") ?? "Rp 0",
    };
  }, [cashAmount, payments]);

  async function saveClosing() {
    if (!actualCashValid) {
      setError("Cash aktual wajib diisi dengan angka valid.");
      setStep(2);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/closings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDateInput,
          actual_cash: actualValue,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Closing gagal.");
      }

      setSavedClosing(normalizeClosing(payload.data));
      onChanged();
      setSaving(false);
      setStep(4);
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : "Closing gagal.");
    }
  }

  async function reopenClosing() {
    if (!existingClosing) {
      return;
    }

    if (reopenReason.trim().length < 5) {
      setError("Alasan reopen wajib diisi minimal 5 karakter.");
      return;
    }

    setReopening(true);
    setError("");

    try {
      const response = await fetch(`/api/closings/${existingClosing.id}/reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reopen_reason: reopenReason,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Reopen gagal.");
      }

      onChanged();
      setReopening(false);
      onClose();
    } catch (reopenError) {
      setReopening(false);
      setError(reopenError instanceof Error ? reopenError.message : "Reopen gagal.");
    }
  }

  const summaryRecord = savedClosing ?? (isClosed ? existingClosing : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
              {summaryRecord ? "Summary Closing" : "Closing Hari Ini"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{selectedDateLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Tutup closing"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="grid grid-cols-4 gap-2 text-xs font-bold">
            {["Ringkasan", "Cash", "Catatan", "Simpan"].map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (!summaryRecord) {
                    setStep(index + 1);
                  }
                }}
                disabled={Boolean(summaryRecord)}
                className={`rounded-xl px-2 py-2 transition active:scale-95 ${
                  step === index + 1
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {summaryRecord && step === 4 ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-teal-50 p-4 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                <p className="font-bold">Status dashboard: Sudah Closing.</p>
                <p className="mt-1 text-sm">
                  Transaksi POS akan ditolak sampai closing dibuka kembali.
                </p>
              </div>
              <ClosingSummary record={summaryRecord} />
              {summaryRecord.status === "CLOSED" ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <p className="text-sm font-bold text-orange-900 dark:text-orange-100">
                    Buka kembali toko
                  </p>
                  <p className="mt-1 text-xs text-orange-800 dark:text-orange-100">
                    Reopen wajib memakai alasan dan akan dicatat untuk audit.
                  </p>
                  <textarea
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                    rows={3}
                    placeholder="Alasan buka kembali"
                    className="mt-3 w-full resize-none rounded-xl border border-orange-200 bg-white p-3 text-sm text-slate-950 caret-orange-600 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 dark:border-orange-500/30 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={reopenClosing}
                    disabled={reopening}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reopening ? "Membuka kembali..." : "Buka Kembali / Reopen"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!summaryRecord || step !== 4 ? (
            <>
              {step === 1 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ClosingMetric label="Omzet hari ini" value={grossOmzet} />
                  <ClosingMetric label="Total transaksi" value={String(transactionCount)} />
                  <ClosingMetric label="Cash" value={paymentMap.cash} />
                  <ClosingMetric label="QRIS" value={paymentMap.qris} />
                  <ClosingMetric label="Transfer" value={paymentMap.transfer} />
                  <ClosingMetric label="Retur" value={returnValue} tone="danger" />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <ClosingMetric label="Expected cash drawer" value={cashAmount} />
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Cash aktual
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={actualCash}
                      onChange={(event) => {
                        setActualCash(event.target.value.replace(/[^\d]/g, ""));
                        setError("");
                      }}
                      className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold text-slate-950 caret-blue-600 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </label>
                  {!actualCashFilled ? (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      Masukkan cash aktual untuk menghitung selisih.
                    </p>
                  ) : actualCashValid ? (
                    <div
                      className={`rounded-2xl p-4 text-sm font-bold ${
                        difference === 0
                          ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                      }`}
                    >
                      Selisih: {differenceLabel}
                      {difference !== 0 ? (
                        <p className="mt-1 text-xs font-medium">
                          Ada selisih cash. Catat penyebabnya jika diperlukan.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      Cash aktual wajib berupa angka valid.
                    </p>
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Catatan closing
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={6}
                    placeholder="Catatan closing"
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <ClosingSummary
                    record={{
                      date: selectedDateInput,
                      id: "preview",
                      status: "OPEN",
                      expectedCash: cashValue,
                      actualCash: actualValue,
                      difference,
                      notes,
                      grossOmzet: 0,
                      netOmzet: 0,
                      transactionCount,
                      paymentSummary: payments,
                      returnValue: 0,
                      closedBy,
                      closedAt: null,
                      reopenedBy: null,
                      reopenedAt: null,
                      reopenReason: null,
                      logs: [],
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveClosing}
                    disabled={saving}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Menyimpan..." : "Simpan Closing"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {!summaryRecord || step !== 4 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStep(Math.max(step - 1, 1))}
              disabled={step === 1}
              className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-300"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={() => {
                if (step === 2 && !actualCashValid) {
                  setError("Cash aktual wajib diisi dengan angka valid.");
                  return;
                }

                setStep(Math.min(step + 1, 4));
              }}
              disabled={step === 4 || (step === 2 && !actualCashValid)}
              className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-600"
            >
              Lanjut
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClosingMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p
        className={`mt-2 text-xl font-extrabold ${
          tone === "danger" ? "text-rose-600" : "text-slate-950 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ClosingSummary({ record }: { record: ClosingRecord }) {
  return (
    <div className="space-y-3">
      {[
        ["Status", record.status],
        ["Expected cash", formatRupiah(record.expectedCash)],
        ["Actual cash", formatRupiah(record.actualCash)],
        ["Selisih", formatRupiah(record.difference)],
        ["Closed by", record.closedBy ?? "-"],
        ["Waktu closing", record.closedAt ? formatTime(record.closedAt) : "-"],
      ].map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
        >
          <span className="text-sm text-slate-500">{label}</span>
          <strong className="text-right text-sm text-slate-950 dark:text-white">{value}</strong>
        </div>
      ))}
      {record.notes ? (
        <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500">Catatan closing</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{record.notes}</p>
        </div>
      ) : null}
      {record.reopenedAt ? (
        <div className="rounded-xl border border-orange-100 p-4 dark:border-orange-500/20">
          <p className="text-xs font-bold text-orange-700 dark:text-orange-200">
            Reopen terakhir
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {formatTime(record.reopenedAt)} oleh {record.reopenedBy ?? "-"}
          </p>
          {record.reopenReason ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {record.reopenReason}
            </p>
          ) : null}
        </div>
      ) : null}
      {record.logs.length > 0 ? (
        <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500">Audit closing</p>
          <div className="mt-3 space-y-2">
            {record.logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                <span className="font-bold">{log.action}</span>
                {" - "}
                {log.userName ?? "-"} {log.createdAt ? `(${formatTime(log.createdAt)})` : ""}
                {log.reason || log.note ? (
                  <p className="mt-1">{log.reason ?? log.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
