# Cron: Auto-expire pending payment

Transaksi PENDING yang melewati `expiredAt` (15 menit) di-cancel otomatis dan stok dikembalikan.

## Cara kerja

`scripts/expire-pending-sales.mjs` — query batch sale PENDING yang sudah lewat `expiredAt`, lalu dalam satu Serializable transaction:
1. Update status → `CANCELLED / FAILED`
2. Kembalikan stok tiap item
3. Catat `StockMovement` tipe `SALE_AUTO_EXPIRE_RESTORE`

Script adalah plain ES module (`.mjs`) — tidak butuh TypeScript, tidak butuh build step, tidak ada warning.

---

## Requirement

- **Node.js ≥ 18** (tidak butuh 22+)
- `.env` dibaca otomatis oleh Prisma (tidak butuh dotenv tambahan)

---

## Setup cron di VPS (Hostinger KVM2)

### 1. Cari path absolut project dan path node

```bash
pwd              # contoh: /var/www/fishing-pos
which node       # contoh: /usr/bin/node  atau  /home/user/.nvm/versions/node/v20.x/bin/node
```

### 2. Buat direktori log

```bash
mkdir -p /var/log/fishing-pos
```

### 3. Tambah cron job (setiap menit)

```bash
crontab -e
```

Tambahkan (ganti path sesuai server):

```
* * * * * /usr/bin/node /var/www/fishing-pos/scripts/expire-pending-sales.mjs >> /var/log/fishing-pos/expire-pending.log 2>&1
```

> Gunakan path absolut untuk `node` dan script — cron tidak punya PATH yang sama dengan shell interaktif.

**Alternatif via npm script** (jika path npm diketahui):
```
* * * * * cd /var/www/fishing-pos && /usr/bin/npm run expire-pending-sales >> /var/log/fishing-pos/expire-pending.log 2>&1
```

### 4. Verifikasi cron berjalan

```bash
# Tunggu 1-2 menit setelah setup
tail -f /var/log/fishing-pos/expire-pending.log
```

Output normal:
```json
{
  "ok": true,
  "checked": 0,
  "expired": 0,
  "skipped": 0
}
```

---

## Catatan tentang `.env`

Prisma membaca `.env` relatif terhadap lokasi `node_modules/@prisma/client/`, **bukan** `process.cwd()`. Artinya:
- Tidak perlu `export DATABASE_URL` di crontab
- Tidak perlu load `.env` manual
- Selama `node_modules` ada di project directory, `.env` terbaca otomatis

---

## Test manual

### Via npm script langsung (di server)

```bash
cd /var/www/fishing-pos
npm run expire-pending-sales
```

### Via node langsung

```bash
node /var/www/fishing-pos/scripts/expire-pending-sales.mjs
```

### Via API route

Endpoint: `GET /api/cron/expire-pending`

Tanpa secret (jika `CRON_SECRET` tidak di-set di `.env`):
```bash
curl http://localhost:3000/api/cron/expire-pending
```

Dengan secret:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/expire-pending
```

Response sukses:
```json
{ "ok": true, "checked": 2, "expired": 2, "skipped": 0 }
```

---

## Environment variable (opsional)

Tambahkan ke `.env` di server untuk mengamankan API route dari akses publik:

```
CRON_SECRET=isi-dengan-string-random-panjang
```

Generate secret:
```bash
openssl rand -hex 32
```

Jika `CRON_SECRET` tidak di-set, API route terbuka — set di production jika domain bisa diakses publik.

---

## Checklist deploy

- [ ] Node.js ≥ 18 terinstall (`node -v`)
- [ ] Cron entry sudah ditambahkan (`crontab -l` untuk verifikasi)
- [ ] `/var/log/fishing-pos/` sudah dibuat
- [ ] Log menunjukkan `"ok": true` setelah 1-2 menit
- [ ] `CRON_SECRET` di-set di `.env` production
