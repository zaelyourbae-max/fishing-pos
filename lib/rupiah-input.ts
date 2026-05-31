/**
 * Utilities for rupiah-formatted integer inputs.
 * State stores raw digits only ("200000"), display uses formatted ("200.000").
 */

/** Strip non-digits and leading zeros → raw digit string */
export function normalizeRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(?=\d)/, "");
}

/** Raw digit string → formatted display string ("200000" → "200.000") */
export function formatRupiahInput(raw: string): string {
  const normalized = normalizeRupiahInput(raw);
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Formatted or raw string → number (for submit) */
export function parseRupiahInput(value: string): number {
  const normalized = normalizeRupiahInput(value);
  if (!normalized) return 0;
  const amount = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(amount) ? amount : 0;
}
