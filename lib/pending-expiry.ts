export type PendingExpiryTone = "normal" | "warning" | "danger" | "expired";

export type PendingExpiryState = {
  remainingMs: number;
  totalSeconds: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  tone: PendingExpiryTone;
  label: string;
};

function timestampFromExpiredAt(expiredAt: Date | string | null | undefined) {
  if (!expiredAt) {
    return null;
  }

  const timestamp =
    expiredAt instanceof Date ? expiredAt.getTime() : Date.parse(expiredAt);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function pendingExpiryState(
  expiredAt: Date | string | null | undefined,
  now = Date.now(),
): PendingExpiryState | null {
  const expiredAtMs = timestampFromExpiredAt(expiredAt);

  if (!expiredAtMs) {
    return null;
  }

  const remainingMs = Math.max(0, expiredAtMs - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpired = remainingMs <= 0;
  const timeLabel = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const tone: PendingExpiryTone = isExpired
    ? "expired"
    : totalSeconds <= 60
      ? "danger"
      : totalSeconds <= 300
        ? "warning"
        : "normal";

  return {
    remainingMs,
    totalSeconds,
    minutes,
    seconds,
    isExpired,
    tone,
    label: isExpired ? "Menunggu auto cancel..." : `Expired dalam ${timeLabel}`,
  };
}
