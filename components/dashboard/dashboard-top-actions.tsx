"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Calendar,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Info,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  CheckCircle2,
  Wallet,
  X,
} from "lucide-react";

import { downloadOwnerReportPdf } from "@/components/reports/download-owner-report-pdf";
import { formatDateID, formatDateTimeID, parseIDDateInput } from "@/lib/date-format";

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

function DashboardDateFilter({
  selectedDateInput,
}: {
  selectedDateInput: string;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [dateText, setDateText] = useState(formatDateID(selectedDateInput));
  const [error, setError] = useState("");

  function normalizeDateInput(value: string) {
    const parsed = parseIDDateInput(value);

    if (!parsed) {
      setError("Tanggal wajib memakai format dd/mm/yyyy.");
      return null;
    }

    setError("");
    setDateText(formatDateID(parsed));

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = parsed;
    }

    return parsed;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = normalizeDateInput(dateText);

    if (!parsed) {
      event.preventDefault();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="contents sm:flex sm:min-w-0 sm:flex-none sm:items-center sm:gap-2"
    >
      <input
        ref={hiddenInputRef}
        type="hidden"
        name="date"
        defaultValue={selectedDateInput}
      />
      <div className="relative col-start-2 row-start-1 min-w-0 sm:flex-none">
        <label className="sr-only" htmlFor="dashboard-date-filter">
          Pilih tanggal dashboard
        </label>
        <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          id="dashboard-date-filter"
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={dateText}
          onChange={(event) => {
            setDateText(event.target.value);
            setError("");
          }}
          onBlur={(event) => normalizeDateInput(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-bold text-slate-700 shadow-sm outline-none transition duration-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:h-12 sm:w-52 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-500/10"
          title="Pilih tanggal dashboard"
        />
        {error ? (
          <p className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm dark:border-rose-500/30 dark:bg-slate-950 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className="col-span-1 col-start-1 row-start-2 inline-flex h-11 min-w-[120px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:h-12 sm:min-w-0 sm:px-4 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-500/60 dark:focus:ring-blue-500/10"
      >
        Terapkan
      </button>
    </form>
  );
}

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
  const [exportingPdf, setExportingPdf] = useState(false);
  const todayInput = useMemo(() => dateInputValue(new Date()), []);
  const selectedClosingRecord = useClosingRecord(selectedDateInput);
  const todayClosingRecord = useClosingRecord(todayInput);
  const isSelectedToday = selectedDateInput === todayInput;
  const selectedStatus = selectedClosingRecord.status;
  const isSelectedClosed = selectedStatus === "CLOSED";
  const closingButtonLabel = isSelectedToday
    ? isSelectedClosed
      ? "Lihat Closing Hari Ini"
      : "Closing Hari Ini"
    : selectedClosingRecord.closing
      ? "Lihat Closing Tanggal Ini"
      : "Lihat Status Tanggal Ini";
  const closingButtonTitle = isSelectedToday
    ? isSelectedClosed
      ? "Lihat closing hari ini"
      : "Mulai closing hari ini"
    : "Lihat closing untuk tanggal yang dipilih";
  const exportPdfHref = `/api/reports/export/pdf?date=${encodeURIComponent(
    selectedDateInput,
  )}`;

  async function exportPdf() {
    setExportingPdf(true);

    try {
      await downloadOwnerReportPdf(
        exportPdfHref,
        `owner-report-${selectedDateInput}.pdf`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Export PDF gagal.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <>
      <div className="grid w-full grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)_44px] gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 xl:justify-end">
        <div className="relative col-start-1 row-start-1 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setNotificationOpen((open) => !open)}
            aria-expanded={notificationOpen}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10 sm:h-12 sm:w-12"
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
            <div className="absolute left-0 top-12 z-30 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:left-auto sm:right-0">
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

        <DashboardDateFilter
          key={selectedDateInput}
          selectedDateInput={selectedDateInput}
        />

        <a
          href={`/dashboard?date=${selectedDateInput}`}
          className="col-start-3 row-start-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:h-12 sm:w-12 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-500/60 dark:focus:ring-blue-500/10"
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
        >
          <RefreshCw className="h-4 w-4" />
        </a>

        <button
          type="button"
          onClick={exportPdf}
          disabled={exportingPdf}
          className="col-span-2 col-start-2 row-start-2 inline-flex h-11 min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:flex-none sm:px-5 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-teal-500/10 dark:focus:ring-teal-500/10"
          title="Export PDF"
        >
          {exportingPdf ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exportingPdf ? "Mengunduh..." : "Export PDF"}
        </button>

        <button
          type="button"
          onClick={() => setClosingOpen(true)}
          className={`col-span-3 row-start-3 inline-flex h-11 w-full min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:h-12 sm:w-auto sm:min-w-[150px] dark:focus:ring-teal-500/10 ${
            isSelectedClosed
              ? "bg-teal-600 hover:bg-teal-700"
              : isSelectedToday
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-slate-700 hover:bg-slate-800"
          }`}
          title={closingButtonTitle}
        >
          {isSelectedClosed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          {closingButtonLabel}
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
          existingClosing={selectedClosingRecord.closing}
          closingStatus={selectedStatus}
          operationalStatus={todayClosingRecord.status}
          isOperationalDate={isSelectedToday}
          onChanged={() => {
            selectedClosingRecord.refresh();
            todayClosingRecord.refresh();
          }}
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
  const todayInput = useMemo(() => dateInputValue(new Date()), []);
  const selectedClosingRecord = useClosingRecord(selectedDateInput);
  const todayClosingRecord = useClosingRecord(todayInput);
  const isSelectedToday = selectedDateInput === todayInput;
  const closing = selectedClosingRecord.closing;
  const status = selectedClosingRecord.status;
  const operationalStatus = isSelectedToday ? status : todayClosingRecord.status;
  const roleLabel =
    role === "cashier"
      ? `Kasir: ${userName}`
      : role === "developer"
        ? `Login sebagai Developer`
        : `Owner: ${userName}`;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      <span className="flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl border border-teal-100 bg-white px-3.5 py-3 text-xs font-bold text-teal-700 shadow-sm dark:border-teal-500/20 dark:bg-slate-950/70 dark:text-teal-200">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
        </span>
        <span className="min-w-0">
          <span className="block">Login Aktif</span>
          <span className="mt-1 block truncate font-medium text-slate-500 dark:text-slate-400">
            {roleLabel}
          </span>
        </span>
      </span>
      <span
        className={`flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-xs font-bold shadow-sm dark:border-slate-800 dark:bg-slate-950/70 ${
          status === "CLOSED"
            ? "border-teal-200 bg-white text-teal-700"
            : status === "REOPENED"
              ? "border-blue-200 bg-white text-blue-700"
              : "border-slate-200 bg-white text-amber-700"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
          <CalendarDays className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block">Tanggal Dipilih: {closingStatusLabel(status)}</span>
        <span className="sr-only">
        {status === "CLOSED"
          ? "✓ Sudah Closing"
          : status === "REOPENED"
            ? "Reopened"
            : "Belum Closing"}
        </span>
        <span className="mt-1 block truncate font-medium text-slate-500 dark:text-slate-400">
          {status === "CLOSED" && closing?.closedAt
            ? `${selectedDateLabel} • ${formatTime(closing.closedAt)}`
            : selectedDateLabel}
        </span>
        </span>
      </span>
      <span
        className={`flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-xs font-bold shadow-sm dark:border-slate-800 dark:bg-slate-950/70 ${
          operationalStatus === "CLOSED"
            ? "border-teal-200 bg-white text-teal-700"
            : operationalStatus === "REOPENED"
              ? "border-blue-200 bg-white text-blue-700"
              : "border-slate-200 bg-white text-amber-700"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
          <LockKeyhole className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block">Hari Ini / Operasional</span>
          <span className="mt-1 block truncate font-medium">
            {closingStatusLabel(operationalStatus)}
            {!isSelectedToday ? " - berbeda dari tanggal dipilih" : ""}
          </span>
        </span>
      </span>
      <span className="flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-3.5 py-3 text-xs font-bold text-rose-600 shadow-sm dark:border-rose-500/20 dark:bg-slate-950/70 dark:text-rose-200">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block">{lowStockCount} Stok Rendah</span>
          <span className="mt-1 block truncate font-medium text-rose-500 dark:text-rose-200">
            Stok &lt; 10
          </span>
        </span>
      </span>
    </div>
  );
}

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function closingStatusLabel(status: ClosingStatus) {
  if (status === "CLOSED") {
    return "Sudah Closing";
  }

  if (status === "REOPENED") {
    return "Reopened";
  }

  return "Belum Closing";
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
  return formatDateTimeID(value);
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
  operationalStatus,
  isOperationalDate,
  onChanged,
  onClose,
}: Omit<DashboardTopActionsProps, "notificationCount"> & {
  existingClosing: ClosingRecord | null;
  closingStatus: ClosingStatus;
  operationalStatus: ClosingStatus;
  isOperationalDate: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const isClosed = closingStatus === "CLOSED";
  const [step, setStep] = useState(
    isClosed || (!isOperationalDate && existingClosing) ? 4 : 1,
  );
  const [actualCash, setActualCash] = useState(
    isClosed && existingClosing ? String(existingClosing.actualCash) : "",
  );
  const [notes, setNotes] = useState(isClosed ? (existingClosing?.notes ?? "") : "");
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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
  const canCreateClosing = isOperationalDate;

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

  async function downloadClosingPdf(record: ClosingRecord) {
    setDownloadingPdf(true);
    setError("");

    try {
      const response = await fetch(`/api/closings/${record.id}/export/pdf`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? "Download PDF closing gagal.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `closing-${record.date}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Download PDF closing gagal.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  const summaryRecord =
    savedClosing ??
    (isClosed || (!isOperationalDate && existingClosing) ? existingClosing : null);
  const dialogTitle = summaryRecord
    ? isOperationalDate
      ? "Summary Closing Hari Ini"
      : "Summary Closing Tanggal Ini"
    : isOperationalDate
      ? "Closing Hari Ini"
      : "Status Closing Tanggal Ini";
  const closingSteps = ["Ringkasan", "Cash", "Catatan", "Simpan"];
  const canNavigateStep = !summaryRecord && canCreateClosing;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950 sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold leading-tight text-slate-950 dark:text-white sm:text-xl">
              {dialogTitle}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
              {selectedDateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:focus:ring-blue-500/10"
            aria-label="Tutup closing"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
          <div className="grid grid-cols-4 gap-2 sm:hidden">
            {closingSteps.map((label, index) => {
              const active = step === index + 1;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (canNavigateStep) {
                      setStep(index + 1);
                    }
                  }}
                  disabled={!canNavigateStep}
                  className="min-w-0 rounded-2xl px-1 py-1.5 text-center transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-extrabold transition duration-200 ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`mt-1 block truncate text-[10px] font-bold ${
                      active ? "text-blue-700 dark:text-blue-300" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden grid-cols-4 gap-2 text-xs font-bold sm:grid">
            {closingSteps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (canNavigateStep) {
                    setStep(index + 1);
                  }
                }}
                disabled={!canNavigateStep}
                className={`inline-flex h-10 items-center justify-center rounded-2xl px-3 transition duration-200 active:scale-95 ${
                  step === index + 1
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {summaryRecord && step === 4 ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-teal-50 p-4 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                <p className="font-bold">
                  Status tanggal ini: {closingStatusLabel(summaryRecord.status)}.
                </p>
                <p className="mt-1 text-sm">
                  {isOperationalDate
                    ? summaryRecord.status === "CLOSED"
                      ? "Transaksi POS akan ditolak sampai closing dibuka kembali."
                      : "Operasional hari ini sudah dibuka kembali dan bisa closing ulang."
                    : `Anda sedang melihat closing tanggal ${selectedDateLabel}. Reopen tanggal ini tidak membuka atau menutup operasional hari ini.`}
                </p>
              </div>
              {!isOperationalDate ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                  Status operasional hari ini:{" "}
                  <span className="font-bold">{closingStatusLabel(operationalStatus)}</span>.
                </div>
              ) : null}
              <ClosingSummary record={summaryRecord} />
              <button
                type="button"
                onClick={() => downloadClosingPdf(summaryRecord)}
                disabled={downloadingPdf}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 text-sm font-bold text-teal-700 transition hover:bg-teal-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-500/30 dark:bg-slate-950 dark:text-teal-200 dark:hover:bg-teal-500/10"
              >
                {downloadingPdf ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloadingPdf ? "Mengunduh..." : "Download PDF Closing"}
              </button>
              {summaryRecord.status === "CLOSED" ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <p className="text-sm font-bold text-orange-900 dark:text-orange-100">
                    {isOperationalDate ? "Buka kembali toko" : "Reopen Tanggal Ini"}
                  </p>
                  <p className="mt-1 text-xs text-orange-800 dark:text-orange-100">
                    {isOperationalDate
                      ? "Reopen wajib memakai alasan dan akan dicatat untuk audit."
                      : "Reopen ini hanya membuka ulang closing untuk tanggal yang dipilih."}
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
                    {reopening
                      ? "Membuka kembali..."
                      : isOperationalDate
                        ? "Buka Kembali / Reopen"
                        : "Reopen Tanggal Ini"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!summaryRecord && !canCreateClosing ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                <p className="font-bold">
                  Anda sedang melihat closing tanggal {selectedDateLabel}.
                </p>
                <p className="mt-1 text-sm">
                  Closing baru hanya bisa dibuat untuk Hari Ini / Operasional
                  Sekarang. Status operasional hari ini:{" "}
                  <span className="font-bold">{closingStatusLabel(operationalStatus)}</span>.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Belum ada record closing untuk tanggal yang dipilih.
              </div>
            </div>
          ) : null}

          {(!summaryRecord || step !== 4) && canCreateClosing ? (
            <>
              {step === 1 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ClosingMetric label="Omzet hari ini" value={grossOmzet} />
                    <ClosingMetric
                      label="Total transaksi"
                      value={String(transactionCount)}
                    />
                    <ClosingMetric
                      label="Cash (Expected)"
                      value={paymentMap.cash}
                    />
                    <ClosingMetric label="QRIS" value={paymentMap.qris} />
                    <ClosingMetric label="Transfer" value={paymentMap.transfer} />
                    <ClosingMetric
                      label="Retur"
                      value={returnValue}
                      tone="danger"
                    />
                  </div>
                  <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Pastikan seluruh data di atas sudah sesuai sebelum
                      melanjutkan ke langkah berikutnya.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <ClosingMetric
                    label="Cash seharusnya (Expected)"
                    value={cashAmount}
                  />
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Cash aktual
                    </span>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={actualCash}
                        onChange={(event) => {
                          setActualCash(event.target.value.replace(/[^\d]/g, ""));
                          setError("");
                        }}
                        placeholder="Masukkan jumlah cash aktual"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-14 text-lg font-bold text-slate-950 caret-blue-600 shadow-sm outline-none transition duration-200 placeholder:text-sm placeholder:font-medium placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-500/10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        Rp
                      </span>
                    </div>
                  </label>
                  {!actualCashFilled ? (
                    <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Masukkan cash aktual untuk menghitung selisih.</p>
                    </div>
                  ) : actualCashValid ? (
                    <div
                      className={`rounded-2xl border p-4 text-sm font-bold shadow-sm ${
                        difference === 0
                          ? "border-teal-100 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200"
                          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span>Selisih</span>
                        <span className="whitespace-nowrap text-lg">
                          {differenceLabel}
                        </span>
                      </div>
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
                  <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-100">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Selisih akan dihitung otomatis setelah cash aktual diisi.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      Catatan closing
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        Opsional
                      </span>
                    </span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={7}
                      placeholder="Tuliskan catatan atau keterangan jika ada selisih, retur, atau hal lain yang perlu dicatat."
                      className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-950 caret-blue-600 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-500/10"
                    />
                  </label>
                  <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-100">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Catatan akan membantu Anda dan tim saat melakukan
                      pengecekan data di kemudian hari.
                    </p>
                  </div>
                </div>
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
                  <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Setelah disimpan, data closing akan mengunci rekap hari ini
                      dan tidak dapat diubah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveClosing}
                    disabled={saving}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Menyimpan..." : "Simpan Closing"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {(!summaryRecord || step !== 4) && canCreateClosing ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:p-5">
            <button
              type="button"
              onClick={() => setStep(Math.max(step - 1, 1))}
              disabled={step === 1}
              className="inline-flex h-11 min-w-28 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
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
              className="inline-flex h-11 min-w-32 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-70 dark:bg-blue-600 dark:disabled:bg-slate-800"
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
  const isDanger = tone === "danger";

  return (
    <div
      className={`flex min-h-24 items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition duration-200 dark:bg-slate-950 ${
        isDanger
          ? "border-rose-100 dark:border-rose-500/20"
          : "border-slate-100 dark:border-slate-800"
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          isDanger
            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"
            : "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
        }`}
      >
        {renderClosingMetricIcon(label)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold leading-snug text-slate-500">
          {label}
        </p>
        <p
          className={`mt-1 whitespace-nowrap text-xl font-extrabold leading-tight ${
            isDanger ? "text-rose-600" : "text-slate-950 dark:text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function renderClosingMetricIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("omzet")) {
    return <Wallet className="h-5 w-5" />;
  }

  if (normalized.includes("transaksi")) {
    return <ReceiptText className="h-5 w-5" />;
  }

  if (normalized.includes("cash")) {
    return <Banknote className="h-5 w-5" />;
  }

  if (normalized.includes("qris")) {
    return <CreditCard className="h-5 w-5" />;
  }

  if (normalized.includes("transfer")) {
    return <FileText className="h-5 w-5" />;
  }

  if (normalized.includes("retur")) {
    return <RotateCcw className="h-5 w-5" />;
  }

  return <FileText className="h-5 w-5" />;
}

function ClosingSummary({ record }: { record: ClosingRecord }) {
  const isPreview = record.id === "preview";
  const summaryRows: Array<[string, string]> = [
    ...(isPreview
      ? []
      : ([
          ["Omzet kotor", formatRupiah(record.grossOmzet)],
          ["Omzet bersih", formatRupiah(record.netOmzet)],
          ["Total transaksi", String(record.transactionCount)],
          ["Nilai retur", formatRupiah(record.returnValue)],
        ] as Array<[string, string]>)),
    ["Expected cash", formatRupiah(record.expectedCash)],
    ["Actual cash", formatRupiah(record.actualCash)],
    ["Selisih", formatSignedRupiah(record.difference)],
    ["Closed by", record.closedBy ?? "-"],
    ["Waktu closing", record.closedAt ? formatTime(record.closedAt) : "-"],
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
          Status saat ini
        </span>
        <span
          className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-extrabold ${
            record.status === "CLOSED"
              ? "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200"
              : record.status === "REOPENED"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
          }`}
        >
          {record.status}
        </span>
      </div>
      {summaryRows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
        >
          <span className="text-sm text-slate-500">{label}</span>
          <strong className="text-right text-sm text-slate-950 dark:text-white">
            {value}
          </strong>
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
