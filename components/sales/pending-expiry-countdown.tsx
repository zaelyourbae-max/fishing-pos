"use client";

import {
  pendingExpiryState,
  type PendingExpiryTone,
} from "@/lib/pending-expiry";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

type PendingExpiryCountdownProps = {
  expiredAt?: Date | string | null;
  className?: string;
};

const toneClasses: Record<PendingExpiryTone, string> = {
  normal:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  expired:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PendingExpiryCountdown({
  expiredAt,
  className,
}: PendingExpiryCountdownProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!expiredAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiredAt]);

  if (!expiredAt || now === null) {
    return null;
  }

  const state = pendingExpiryState(expiredAt, now);

  if (!state) {
    return null;
  }

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums",
        toneClasses[state.tone],
        className,
      )}
      title={state.isExpired ? "Transaksi sudah lewat batas pending." : undefined}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{state.label}</span>
    </span>
  );
}
