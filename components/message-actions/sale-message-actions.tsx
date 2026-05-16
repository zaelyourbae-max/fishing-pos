"use client";

import { useState } from "react";

const TOKEN_KEY = "fishing_pos_token";

type SaleMessageActionsProps = {
  saleId: string;
  compact?: boolean;
};

type ActionKind = "customer" | "owner";

export default function SaleMessageActions({
  saleId,
  compact = false,
}: SaleMessageActionsProps) {
  const [loading, setLoading] = useState<ActionKind | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function trigger(kind: ActionKind) {
    setLoading(kind);
    setMessage("");
    setError("");

    const token =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(TOKEN_KEY) ?? "";
    const endpoint =
      kind === "customer"
        ? `/api/sales/${saleId}/send-whatsapp-customer`
        : `/api/sales/${saleId}/send-owner-report`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal menyiapkan message log.");
      }

      setMessage(data?.message ?? "Message log siap diproses.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyiapkan message log.",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-3"}>
        <button
          type="button"
          onClick={() => trigger("customer")}
          disabled={loading !== null}
          className={
            compact
              ? "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              : "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          }
        >
          {loading === "customer" ? "Menyiapkan..." : "Send WhatsApp Customer"}
        </button>
        <button
          type="button"
          onClick={() => trigger("owner")}
          disabled={loading !== null}
         className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors duration-200 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {loading === "owner" ? "Menyiapkan..." : "Send Owner Report"}
        </button>
      </div>
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
