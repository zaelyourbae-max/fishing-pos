// Nilai default — dipakai bila owner belum mengatur di Pengaturan.
export const LOYALTY_INTERVAL = 20;
export const LOYALTY_MIN_PURCHASE_AMOUNT = 100_000;

export type LoyaltyConfig = {
  /** Setiap berapa transaksi valid dapat 1 milestone loyalty. */
  interval: number;
  /** Minimal pembelian agar transaksi memenuhi syarat benefit loyalty. */
  minPurchase: number;
};

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  interval: LOYALTY_INTERVAL,
  minPurchase: LOYALTY_MIN_PURCHASE_AMOUNT,
};

export type LoyaltyBenefitType = "NONE" | "FIXED" | "PERCENT";

export type LoyaltyProgress = {
  validTransactions: number;
  nextMilestone: number;
  remainingToNext: number;
  eligibleMilestone: number | null;
};

export function normalizeLoyaltyBenefitType(value: unknown): LoyaltyBenefitType | null {
  const type = String(value ?? "NONE").trim().toUpperCase();

  if (type === "NONE" || type === "FIXED" || type === "PERCENT") {
    return type;
  }

  return null;
}

export function loyaltyProgressFromValidCount(
  validTransactions: number,
  interval: number = LOYALTY_INTERVAL,
): LoyaltyProgress {
  const safeInterval = Math.max(1, Math.floor(interval || LOYALTY_INTERVAL));
  const safeCount = Math.max(0, Math.floor(validTransactions));
  const nextMilestone =
    Math.floor(safeCount / safeInterval) * safeInterval + safeInterval;
  const eligibleMilestone =
    (safeCount + 1) % safeInterval === 0 ? safeCount + 1 : null;

  return {
    validTransactions: safeCount,
    nextMilestone,
    remainingToNext: Math.max(nextMilestone - safeCount, 0),
    eligibleMilestone,
  };
}

export function calculateLoyaltyDiscount(input: {
  type: LoyaltyBenefitType;
  value: number;
  subtotalBeforeLoyalty: number;
}) {
  const subtotal = Math.max(0, Math.round(input.subtotalBeforeLoyalty));
  const value = Math.max(0, Number(input.value || 0));

  if (input.type === "NONE" || subtotal <= 0) {
    return 0;
  }

  if (input.type === "PERCENT") {
    return Math.min(subtotal, Math.round((subtotal * value) / 100));
  }

  return Math.min(subtotal, Math.round(value));
}

export function meetsLoyaltyMinimumPurchase(
  subtotalBeforeLoyalty: number,
  minPurchase: number = LOYALTY_MIN_PURCHASE_AMOUNT,
) {
  const safeMin = Math.max(0, Math.round(minPurchase || 0));

  return Math.max(0, Math.round(subtotalBeforeLoyalty)) >= safeMin;
}
