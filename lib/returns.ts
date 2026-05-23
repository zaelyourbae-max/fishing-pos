import { formatDateTimeID } from "@/lib/date-format";

export const RETURN_REASONS = [
  "BARANG_RUSAK",
  "BARANG_CACAT",
  "SALAH_INPUT_KASIR",
  "CUSTOMER_BATAL",
  "SALAH_BARANG",
  "TUKAR_BARANG",
  "LAINNYA",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  BARANG_RUSAK: "Barang rusak",
  BARANG_CACAT: "Barang cacat",
  SALAH_INPUT_KASIR: "Salah input kasir",
  CUSTOMER_BATAL: "Customer batal",
  SALAH_BARANG: "Salah barang",
  TUKAR_BARANG: "Tukar barang",
  LAINNYA: "Lainnya",
};

export function isReturnReason(value: string): value is ReturnReason {
  return RETURN_REASONS.includes(value as ReturnReason);
}

export function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}
