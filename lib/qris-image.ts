export const QRIS_IMAGE_ENDPOINT = "/api/payment-settings/qris-image";

export function resolveQrisImageUrl(qrisImageUrl: string | null | undefined) {
  const value = String(qrisImageUrl ?? "").trim();

  if (!value) {
    return "";
  }

  if (value.startsWith(QRIS_IMAGE_ENDPOINT)) {
    return value;
  }

  return `${QRIS_IMAGE_ENDPOINT}?v=${encodeURIComponent(value.slice(0, 80))}`;
}
