/**
 * Apakah cookie sesi diberi flag `Secure` (hanya dikirim lewat HTTPS).
 *
 * Default: aktif saat production. Bisa di-override lewat env `COOKIE_SECURE`
 * ("true"/"false"). Berguna untuk sementara mengakses lewat HTTP (alamat IP)
 * sebelum domain + HTTPS terpasang.
 *
 * PENTING: setelah HTTPS aktif, set COOKIE_SECURE="true" (atau hapus override)
 * agar cookie login kembali aman.
 */
export function cookieSecure(): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "false") return false;
  if (override === "true") return true;
  return process.env.NODE_ENV === "production";
}
