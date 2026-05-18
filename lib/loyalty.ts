export const LOYALTY_INTERVAL = 20;
export const LOYALTY_MIN_PURCHASE_AMOUNT = 100_000;

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

export function loyaltyProgressFromValidCount(validTransactions: number): LoyaltyProgress {
  const safeCount = Math.max(0, Math.floor(validTransactions));
  const nextMilestone =
    Math.floor(safeCount / LOYALTY_INTERVAL) * LOYALTY_INTERVAL +
    LOYALTY_INTERVAL;
  const eligibleMilestone =
    (safeCount + 1) % LOYALTY_INTERVAL === 0 ? safeCount + 1 : null;

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

export function meetsLoyaltyMinimumPurchase(subtotalBeforeLoyalty: number) {
  return (
    Math.max(0, Math.round(subtotalBeforeLoyalty)) >=
    LOYALTY_MIN_PURCHASE_AMOUNT
  );
}
