/**
 * Dijalankan SEKALI saat server Next.js mulai (sebelum melayani permintaan).
 *
 * Mengunci zona waktu aplikasi ke WITA / Balikpapan (UTC+8 — Asia/Makassar).
 * PENTING untuk produksi: server VPS umumnya default UTC. Tanpa penguncian ini,
 * pergantian "hari" pada semua laporan akan meleset (mis. hari berganti jam 8
 * pagi WITA, bukan tengah malam) sehingga "Omzet Hari Ini", grafik harian, dan
 * tutup buku harian salah tanggal.
 *
 * Dibiarkan bisa ditimpa lewat variabel lingkungan TZ — kalau suatu saat toko
 * pindah zona waktu, cukup set TZ tanpa mengubah kode.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.TZ) {
    process.env.TZ = "Asia/Makassar";
  }
}
