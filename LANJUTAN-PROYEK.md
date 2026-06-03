# Catatan Lanjutan Proyek — Fishing POS

> File ini sengaja ditaruh DI DALAM repo agar ikut terbawa ke akun/komputer mana pun.
> Untuk Claude di sesi baru: **baca file ini + `git log` + memori (jika ada) sebelum mulai.**

## Tentang pemilik
- Nama: **Bapak Alexander van Meijr** (panggil **"Pak"**, gaya ngobrol hangat & santai seperti ke owner toko).
- Founder **non-teknis** toko pancing. Brand: **Meijrverse / SeaHorse Company**.
- Cara kerja yang dia suka: **pahami → tanya → baru ubah**. Jangan over-inisiatif. Jelaskan dampak ke toko sebelum hal teknis.
- Prioritas: stabilitas > akurasi data > UX kasir > maintenance > fitur baru.

## Catatan teknis penting
- Ini Next.js versi dengan perubahan besar — **baca `node_modules/next/dist/docs/` sebelum nulis kode** (lihat `AGENTS.md`).
- Target deploy: VPS Hostinger (Railway TIDAK dipakai lagi).

## Sudah selesai & SUDAH di-commit (lihat `git log`)
1. **PDF closing** dirapikan (pakai pdf-lib + Inter, header/footer disamakan dgn PDF laporan owner) — commit `fix(closing-pdf)`.
2. **Trend Penjualan** di laporan owner: selalu 7 hari terakhir + label nama hari — commit `feat(laporan-owner)`.
3. **Mode Live** di Mode Analitik (`/reports/preview`): tombol "Mode Live" di samping toggle Perbandingan → flip kartu Chart Harian jadi grafik saham per-transaksi (datar saat sepi, loncat saat ada penjualan), auto-refresh 9 detik, zoom (scroll/cubit/tombol) + geser, panel lebar di desktop — commit `feat(mode-live)`.
   - File: `lib/analytics-terminal.ts` (`getTerminalLive`), `app/api/reports/terminal-live/route.ts`, `app/(DASHBOARD)/reports/preview/page.tsx`, `components/reports/analytics-terminal-preview.tsx` (komponen `LiveCard`).

## RENCANA BERIKUTNYA (belum dikerjakan)
1. **Mode Live versi laporan owner** — bawa grafik Mode Live yang sama ke modul laporan owner (`components/reports/owner-report-view.tsx`). Rencana awal: nyusul setelah versi Mode Analitik disetujui Pak.
2. **Animasi KPI Card** — Pak ingin menggarap animasi pada kartu KPI (kemungkinan di dashboard / laporan owner / Mode Analitik). **Detail belum dibahas — TANYA Pak dulu** maksudnya animasi seperti apa & di kartu mana sebelum mengerjakan.

## PERINGATAN soal file belum di-commit
- Working tree punya **banyak file berubah yang belum di-commit** (kerjaan Pak yang sedang berjalan). File belum di-commit **hanya aman jika folder ini disalin utuh** — kalau pindah lewat `git clone`, yang belum di-commit TIDAK ikut. Saran: bantu Pak commit hal penting bila diminta.
