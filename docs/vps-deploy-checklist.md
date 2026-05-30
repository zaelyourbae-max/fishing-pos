# Deploy Guide — Hostinger VPS KVM2

Panduan lengkap deploy Fishing POS ke VPS. Ikuti urutan ini dari atas ke bawah.

---

## Tahap 1 — VPS Setup Awal

### 1.1 Login & update sistem

```bash
ssh root@<IP_VPS>

apt update && apt upgrade -y
apt install -y curl git unzip ufw
```

### 1.2 Buat user deploy (jangan pakai root untuk app)

```bash
adduser deploy
usermod -aG sudo deploy

# Copy SSH key supaya bisa login tanpa password
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

### 1.3 Firewall dasar

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

---

## Tahap 2 — Timezone

> **Wajib Asia/Makassar.** Logika closing dan laporan bergantung pada timezone proses Node.js.
> Jika salah, transaksi jam 00:00–07:59 WITA akan dianggap hari sebelumnya.

```bash
# Set timezone
sudo timedatectl set-timezone Asia/Makassar

# Verifikasi
timedatectl
# → Time zone: Asia/Makassar (WITA, +0800)

date
# → harus menampilkan WITA

node -e "console.log(new Date().toString())"
# → harus menampilkan +0800
```

---

## Tahap 3 — Node.js

Butuh **Node.js ≥ 18**. Disarankan Node.js 20 LTS.

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifikasi
node -v    # → v20.x.x
npm -v

# Install PM2 secara global
sudo npm install -g pm2
```

---

## Tahap 4 — PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start & enable
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Buat user dan database
sudo -u postgres psql <<'SQL'
CREATE USER fishingpos WITH PASSWORD 'ganti_password_kuat';
CREATE DATABASE fishing_pos OWNER fishingpos;
GRANT ALL PRIVILEGES ON DATABASE fishing_pos TO fishingpos;
SQL

# Verifikasi koneksi
psql -U fishingpos -d fishing_pos -h localhost -c "\conninfo"
```

---

## Tahap 5 — Clone Repository

```bash
# Buat direktori
sudo mkdir -p /var/www/fishing-pos
sudo chown deploy:deploy /var/www/fishing-pos

# Clone (ganti dengan URL repo Anda)
su - deploy
git clone https://github.com/username/fishing-pos.git /var/www/fishing-pos
cd /var/www/fishing-pos
```

---

## Tahap 6 — Environment Variables

```bash
cd /var/www/fishing-pos

# Salin template
cp .env.example .env

# Edit sesuai nilai production
nano .env
```

Isi minimal yang wajib diubah di `.env`:

```env
DATABASE_URL="postgresql://fishingpos:ganti_password_kuat@localhost:5432/fishing_pos"
SESSION_SECRET="<output openssl rand -hex 32>"
CRON_SECRET="<output openssl rand -hex 32>"
NEXT_PUBLIC_APP_URL="https://pos.namadomain.com"
APP_URL="https://pos.namadomain.com"
```

Generate secrets:
```bash
openssl rand -hex 32   # jalankan 2x — satu untuk SESSION_SECRET, satu untuk CRON_SECRET
```

---

## Tahap 7 — Database Migration

```bash
cd /var/www/fishing-pos

npm install

# Jalankan migration Prisma
npx prisma migrate deploy

# Verifikasi tabel terbuat
psql -U fishingpos -d fishing_pos -h localhost -c "\dt"
```

---

## Tahap 8 — Build

```bash
cd /var/www/fishing-pos

npm run build
# Proses ini: prisma generate + next build
# Estimasi waktu: 2–5 menit
```

Pastikan tidak ada error. Jika ada, baca pesan error sebelum lanjut.

---

## Tahap 9 — PM2

```bash
# Buat direktori log
mkdir -p /var/log/fishing-pos

# Start app via PM2
cd /var/www/fishing-pos
pm2 start ecosystem.config.js

# Verifikasi berjalan
pm2 status
pm2 logs fishing-pos --lines 30

# Test akses
curl http://localhost:3000/api/payment-methods
# → harus return JSON (bukan error connection)

# Simpan konfigurasi PM2 agar auto-start setelah reboot
pm2 save
pm2 startup
# Jalankan command yang muncul dari output pm2 startup
```

---

## Tahap 10 — Nginx Reverse Proxy

```bash
sudo apt install -y nginx

# Buat konfigurasi site
sudo nano /etc/nginx/sites-available/fishing-pos
```

Isi file konfigurasi:

```nginx
server {
    listen 80;
    server_name pos.namadomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Aktifkan site
sudo ln -s /etc/nginx/sites-available/fishing-pos /etc/nginx/sites-enabled/

# Test konfigurasi
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# Test akses via domain (setelah DNS sudah diarahkan ke IP VPS)
curl http://pos.namadomain.com
```

---

## Tahap 11 — SSL (Let's Encrypt)

> Jalankan setelah DNS domain sudah diarahkan ke IP VPS dan bisa diakses via HTTP.

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d pos.namadomain.com

# Certbot akan otomatis update konfigurasi Nginx untuk HTTPS

# Verifikasi auto-renewal
sudo certbot renew --dry-run

# Verifikasi HTTPS
curl https://pos.namadomain.com
```

Setelah SSL aktif, update `.env`:
```bash
# Pastikan APP_URL sudah pakai https://
NEXT_PUBLIC_APP_URL="https://pos.namadomain.com"
APP_URL="https://pos.namadomain.com"
```

Lalu rebuild dan restart:
```bash
npm run build
pm2 restart fishing-pos
```

---

## Tahap 12 — Cron Auto-expire Pending Payment

> Detail lengkap di [`docs/cron-expire-pending.md`](cron-expire-pending.md).

```bash
# Buat direktori log (jika belum)
mkdir -p /var/log/fishing-pos

# Cari path absolut node
which node   # contoh: /usr/bin/node

# Tambah cron job
crontab -e
```

Tambahkan baris (ganti path node sesuai output `which node`):

```
* * * * * /usr/bin/node /var/www/fishing-pos/scripts/expire-pending-sales.mjs >> /var/log/fishing-pos/expire-pending.log 2>&1
```

Verifikasi setelah 2 menit:
```bash
tail -f /var/log/fishing-pos/expire-pending.log
# → {"ok":true,"checked":0,"expired":0,"skipped":0}
```

---

## Tahap 13 — Backup Database

Setup backup otomatis harian:

```bash
# Buat script backup
sudo nano /usr/local/bin/backup-fishing-pos.sh
```

Isi:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/fishing-pos"
DATE=$(date +%Y-%m-%d)
mkdir -p "$BACKUP_DIR"
pg_dump -U fishingpos -h localhost fishing_pos | gzip > "$BACKUP_DIR/fishing_pos_$DATE.sql.gz"
# Hapus backup lebih dari 30 hari
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

```bash
sudo chmod +x /usr/local/bin/backup-fishing-pos.sh

# Tambah ke cron (backup tiap hari jam 02:00 WITA)
sudo crontab -e
```

Tambahkan:
```
0 2 * * * /usr/local/bin/backup-fishing-pos.sh >> /var/log/fishing-pos/backup.log 2>&1
```

---

## Tahap 14 — Test Final Sebelum Go-Live

Jalankan semua test ini secara berurutan:

### Infrastruktur
```bash
# Timezone benar
timedatectl | grep "Asia/Makassar"

# PM2 jalan
pm2 status | grep "fishing-pos.*online"

# Nginx jalan
sudo systemctl status nginx | grep "active (running)"

# App merespons
curl -s https://pos.namadomain.com | grep -c "html"
```

### Fungsional (lewat browser)

1. **Login** — masuk sebagai owner dan kasir
2. **Produk** — tambah produk baru, cek stok
3. **Transaksi CASH** — buat sale, konfirmasi. Cek closing date di halaman Closing — harus sesuai tanggal WITA hari ini
4. **Transaksi QRIS** — buat sale QRIS, upload bukti bayar. Harus berhasil masuk status PAID
5. **Transaksi QRIS + Closing** — buat sale QRIS, lakukan closing hari ini, coba upload bukti → harus ditolak dengan pesan closing
6. **Closing** — lakukan closing, pastikan angka sesuai
7. **Nonaktifkan kasir** — owner nonaktifkan kasir, refresh halaman kasir → harus logout otomatis
8. **Pending expire** — buat transaksi QRIS, tunggu >15 menit tanpa upload bukti → status harus auto-cancel (atau trigger manual: `node /var/www/fishing-pos/scripts/expire-pending-sales.mjs`)
9. **Laporan** — buka laporan harian, pastikan tanggal dan angka benar

### Monitoring
```bash
# Tidak ada error di log PM2
pm2 logs fishing-pos --lines 50 --nostream | grep -i error

# Cron expire berjalan
tail -5 /var/log/fishing-pos/expire-pending.log
```

---

## Referensi Cepat

| Aksi | Command |
|---|---|
| Restart app | `pm2 restart fishing-pos` |
| Lihat log app | `pm2 logs fishing-pos` |
| Pull update | `git pull && npm run build && pm2 restart fishing-pos` |
| Cek cron | `crontab -l` |
| Backup manual | `sudo /usr/local/bin/backup-fishing-pos.sh` |
| Restore backup | `gunzip -c backup.sql.gz \| psql -U fishingpos fishing_pos` |
