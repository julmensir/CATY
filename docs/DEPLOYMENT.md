# 🚢 Panduan Deployment & Operasional

Panduan memasang CATY di server (VPS Linux), mengamankannya, dan merawatnya. Contoh memakai Ubuntu 22.04/24.04.

## Daftar Isi

- [Kebutuhan Server](#kebutuhan-server)
- [Instalasi di Server](#instalasi-di-server)
- [Menjalankan dengan PM2](#menjalankan-dengan-pm2)
- [Alternatif: systemd](#alternatif-systemd)
- [Nginx sebagai Reverse Proxy](#nginx-sebagai-reverse-proxy)
- [HTTPS dengan Let's Encrypt](#https-dengan-lets-encrypt)
- [Checklist Keamanan Produksi](#checklist-keamanan-produksi)
- [Backup & Restore](#backup--restore)
- [Memperbarui Aplikasi](#memperbarui-aplikasi)
- [Pemantauan](#pemantauan)
- [Pemecahan Masalah](#pemecahan-masalah)

---

## Kebutuhan Server

| Komponen | Minimum | Catatan |
|---|---|---|
| CPU / RAM | 1 vCPU / 1 GB | Graph dan indeks ada di memori; 2 GB lebih nyaman untuk pengetahuan besar |
| Disk | 5 GB | Cache embedding, graph, sesi, dan backup bertambah seiring waktu |
| OS | Ubuntu/Debian modern | Windows juga bisa untuk pengembangan |
| Node.js | 20 LTS atau lebih baru | |
| PostgreSQL | 14+ | Wajib untuk feedback, analytics, learning queue |
| Jaringan keluar | HTTPS ke API provider AI | |

---

## Instalasi di Server

```bash
# Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-client nginx

# Zona waktu (memengaruhi jadwal backup dan grafik harian)
sudo timedatectl set-timezone Asia/Jakarta

# Ambil kode
sudo mkdir -p /opt/caty && sudo chown $USER /opt/caty
git clone <url-repo-anda> /opt/caty
cd /opt/caty
npm install --omit=dev

# Konfigurasi
cp .env.example .env
nano .env        # isi sesuai README; set NODE_ENV=production
chmod 600 .env   # hanya pemilik yang boleh baca
```

Siapkan database sesuai [DATABASE.md](DATABASE.md#menyiapkan-database), lalu uji:

```bash
node index.js
# Tekan Ctrl+C setelah muncul "CATY siap di http://localhost:3000"
```

---

## Menjalankan dengan PM2

```bash
sudo npm install -g pm2
pm2 start index.js --name caty
pm2 save
pm2 startup        # jalankan perintah yang ditampilkan agar otomatis hidup saat boot
```

Perintah harian:

```bash
pm2 status
pm2 logs caty --lines 100
pm2 restart caty
```

PM2 menghentikan proses dengan `SIGINT`, yang sudah ditangani kode (sesi, graph, dan cache embedding disimpan sebelum keluar).

---

## Alternatif: systemd

Kode hanya menangani sinyal **`SIGINT`**. Jika systemd mengirim `SIGTERM` (bawaan), sesi dan graph yang belum tersimpan bisa hilang. Karena itu atur `KillSignal=SIGINT`.

`/etc/systemd/system/caty.service`:

```ini
[Unit]
Description=CATY - Chat AI Tegalrejo Yogyakarta
After=network.target postgresql.service

[Service]
Type=simple
User=caty
WorkingDirectory=/opt/caty
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
Environment=TZ=Asia/Jakarta

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /usr/sbin/nologin caty
sudo chown -R caty:caty /opt/caty
sudo systemctl daemon-reload
sudo systemctl enable --now caty
sudo journalctl -u caty -f
```

> Pengguna `caty` harus bisa **menulis** ke `/opt/caty` (folder `data/`, `memory/`, `knowledge/`, `logs/`, `tmp/`, `public/uploads/`) dan file `.env` (untuk fitur ganti password).

---

## Nginx sebagai Reverse Proxy

Chat memakai **streaming SSE**, jadi *buffering* proxy **harus dimatikan** untuk `/api/chat`. Tanpa itu, jawaban muncul sekaligus di akhir, bukan bertahap.

`/etc/nginx/sites-available/caty`:

```nginx
server {
    listen 80;
    server_name caty.contoh.id;

    client_max_body_size 10m;   # unggah pengetahuan (5 MB) dan restore backup

    location /api/chat {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;          # penting untuk SSE
        proxy_cache off;
        proxy_read_timeout 120s;      # fallback antar provider bisa lama
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/caty /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Server memakai `trust proxy = 1`, cocok untuk **satu** lapis proxy. Jika ada Cloudflare di depan Nginx, sesuaikan agar IP klien tetap terbaca benar (rate limit memakai IP).

---

## HTTPS dengan Let's Encrypt

PWA (instalasi ke layar utama dan service worker) **mensyaratkan HTTPS** kecuali di `localhost`.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d caty.contoh.id
```

Pastikan `NODE_ENV=production` di `.env` supaya cookie login ditandai `secure`, lalu restart aplikasi.

---

## Checklist Keamanan Produksi

- [ ] `JWT_SECRET` dan `ENCRYPTION_KEY` acak dan unik (jangan memakai contoh)
- [ ] `ADMIN_PASSWORD_HASH` terisi; **tidak** memakai `admin123`
- [ ] `NODE_ENV=production` dan situs diakses lewat HTTPS
- [ ] `.env` berizin `600` dan **tidak** masuk Git (`.gitignore`)
- [ ] `ENCRYPTION_KEY` disimpan salinannya di tempat aman, **terpisah** dari server
- [ ] Batasi CORS ke domain Anda (ubah `cors({ origin: true })` di `index.js`)
- [ ] Pertimbangkan membatasi `/admin/` per IP atau VPN di Nginx
- [ ] Pertimbangkan membatasi `/api/health` (membuka jumlah data internal)
- [ ] Firewall hanya membuka port 80/443 (dan SSH); port 3000 dan 5432 tidak terbuka ke publik
- [ ] Ganti nomor kontak contoh di System Prompt dan isi `contactInfo` dengan data resmi
- [ ] Uji **restore** backup minimal sekali (lihat di bawah)
- [ ] Rotasi API key provider secara berkala; jangan menempelkannya di tempat lain

---

## Backup & Restore

### Yang dilakukan backup

Otomatis tiap hari **02.00** (zona waktu server) dan manual dari menu **Backup**. Hasilnya `data/backups/backup-<tanggal>.zip.enc`, terenkripsi AES-256-GCM dengan `ENCRYPTION_KEY`. Hanya `BACKUP_KEEP_COUNT` file terbaru yang disimpan (default 4).

| Isi backup | Kondisi |
|---|---|
| `database_dump.sql` (dump PostgreSQL) | Hanya jika `USE_DB=true` dan `pg_dump` tersedia |
| `knowledge/` | Selalu |
| `knowledge-graph.json` | Jika ada |
| `embedding-cache.json` | Jika ada |

**Tidak ikut dibackup:** `data/unanswered.json`, `memory/sessions/`, `logs/notifications.json`, dan `public/uploads/` (logo). Salin manual jika dianggap penting.

Jika `pg_dump` gagal, backup tetap dibuat tanpa dump SQL dan hanya mencatat error di log. Tombol **Backup** di dashboard tetap menampilkan "Backup dibuat" walau proses di dalamnya gagal, karena kegagalan hanya ditulis ke log. **Periksa isi backup** sesekali, jangan hanya mengandalkan file-nya ada.

Di Windows, jalur `pg_dump` ditetapkan ke `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`. Ubah di `runBackup()` jika versi PostgreSQL Anda berbeda.

### Cara restore

1. Buka menu **Backup**, pilih file `.zip.enc`, lalu **Restore** (atau `POST /api/admin/backup/restore`).
2. Server mendekripsi, mengekstrak, menyalin file, dan menyimpan salinan pengaman file yang ditimpa di `tmp/pre_restore_<timestamp>/`.
3. **Restart server.**
4. **Pulihkan database secara manual**, karena restore tidak mengimpor dump SQL:

```bash
# Dekripsi backup secara manual (butuh ENCRYPTION_KEY yang sama) lalu ambil dump SQL-nya:
node -e "
import('crypto').then(({default: c}) => {
  const fs = require('fs');
  const buf = fs.readFileSync(process.argv[1]);
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = buf.subarray(8, 20), tag = buf.subarray(20, 36), enc = buf.subarray(36);
  const d = c.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  fs.writeFileSync('backup.zip', Buffer.concat([d.update(enc), d.final()]));
});
" data/backups/backup-XXXX.zip.enc
unzip backup.zip database_dump.sql
psql -h localhost -U caty -d db_caty -f database_dump.sql
```

> Format file: 8 byte header `SIVTBK01`, 12 byte IV, 16 byte *auth tag*, lalu data terenkripsi. Skrip di atas mengikuti format itu. Jalankan dengan `ENCRYPTION_KEY` yang sama dengan server (`export $(grep ENCRYPTION_KEY .env)`).

### Pindah server (migrasi)

1. Pasang aplikasi di server baru, **salin `.env` yang sama** (terutama `ENCRYPTION_KEY`).
2. Salin file backup terbaru ke `data/backups/`.
3. Restore lewat dashboard, impor dump SQL, restart.

Tanpa `ENCRYPTION_KEY` yang sama, backup **tidak bisa dibuka** dan API key provider yang tersimpan tidak bisa didekripsi (tambahkan ulang manual).

### Salinan tambahan yang disarankan

Backup berada di server yang sama, jadi **bukan** perlindungan jika disk rusak. Salin `data/backups/` ke tempat lain secara berkala (mis. `rsync` ke server lain atau penyimpanan cloud).

---

## Memperbarui Aplikasi

```bash
cd /opt/caty
git pull
npm install --omit=dev
pm2 restart caty        # atau: sudo systemctl restart caty
```

Setelah merilis perubahan **frontend**:
- Naikkan nilai `CACHE_NAME` di `public/sw.js` (mis. `sivt-ai-v5`) dan `admin-public/sw-admin.js` (`caty-admin-v2`). Service worker lama akan menghapus cache lama saat aktivasi.
- Service worker warga *network-first* sehingga perubahan umumnya langsung terlihat. Service worker admin *cache-first* untuk JS/CSS, jadi **menaikkan versi cache wajib** agar admin menerima pembaruan.

---

## Pemantauan

- `GET /api/health` untuk uptime, jumlah provider, chunk, memori, status graph, dan RAG.
- Halaman **Notifikasi** di dashboard: peringatan "Semua Provider Gagal" muncul maksimal sekali per 5 menit.
- Log aplikasi memakai awalan: `[CHAT]`, `[CLASSIFY]`, `[RAG]`, `[GRAPH]`, `[MEMORY]`, `[FALLBACK]`, `[BACKUP]`, `[CRON]`, `[DB]`, `[AUTH]`.

Contoh cek cepat:

```bash
curl -s http://localhost:3000/api/health | jq '{status, uptime, knowledgeChunks, providers}'
```

---

## Pemecahan Masalah

| Gejala / pesan log | Penyebab | Solusi |
|---|---|---|
| `FATAL: JWT_SECRET tidak ada atau terlalu pendek` | `.env` kosong/kurang dari 32 karakter | Isi `JWT_SECRET` ≥ 32 karakter |
| `FATAL: ENCRYPTION_KEY harus 64 karakter hex` | Panjang bukan 64 atau bukan hex | Buat ulang dengan `randomBytes(32).toString('hex')` |
| `FATAL: Gagal konek ke PostgreSQL` | Kredensial salah / DB mati / `USE_DB=true` tanpa DB | Periksa `PG*` atau `DATABASE_URL`, cek `systemctl status postgresql`, atau set `USE_DB=false` sementara |
| `[SECURITY] Tidak ada password di .env. Pakai default admin123` | Hash/password tidak diset | Isi `ADMIN_PASSWORD_HASH` |
| Tidak bisa login, pesan "Username atau password salah" | Salah isian, atau dibatasi rate limit | Tunggu 15 menit setelah 10 gagal; cek `ADMIN_USERNAME` |
| Login berhasil tapi langsung keluar | `NODE_ENV=production` tetapi akses lewat HTTP | Pakai HTTPS |
| `Belum ada provider chat aktif` | Belum ada provider berperan `chat` yang aktif | Tambah provider di dashboard dan aktifkan peran `chat` |
| `Semua provider AI gagal` | API key salah, kuota habis, atau model dihentikan | Uji tiap provider lewat tombol **Test**; perbarui nama model |
| `HTTP 401: API key tidak valid` / `HTTP 429: Kuota habis` | Key salah / kuota gratis habis | Ganti key, tambah provider cadangan |
| `HTTP 404: Model tidak tersedia` | Nama model sudah tidak ada | **Edit Model** di dashboard |
| `Tidak ada provider embedding. Cuma BM25 yang aktif.` | Belum ada provider berperan `embedding` | Normal. Tambahkan peran `embedding` (Gemini/Mistral/Together) untuk pencarian semantik |
| Jawaban muncul sekaligus, tidak bertahap | Nginx mem-*buffer* SSE | Tambahkan `proxy_buffering off` pada `/api/chat` |
| Semua jawaban "belum ada di buku" | Knowledge kosong atau belum dimuat | Cek `knowledgeChunks` di `/api/health`; klik **Reload** |
| Dashboard feedback/learning selalu 0 | `USE_DB=false` | Aktifkan PostgreSQL |
| Pengaturan "batas chat per sesi" tidak berpengaruh | Nilai dibaca sekali saat start (lihat README, poin 5) | Ubah angka bawaan di `index.js` lalu restart |
| `[BACKUP] Gagal pg_dump` | `pg_dump` tidak ada di PATH / variabel `PG*` tidak diisi | `sudo apt install postgresql-client`; isi `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` |
| `File bukan backup SIVT AI (magic header salah)` | Bukan file backup CATY | Pakai file `.zip.enc` hasil aplikasi ini |
| `Format cipher tidak valid` / gagal dekripsi | `ENCRYPTION_KEY` berbeda dari saat enkripsi | Pakai kunci asli |
| Admin tidak menampilkan perubahan terbaru | Service worker admin *cache-first* | Naikkan `CACHE_NAME` di `sw-admin.js`, atau hapus data situs di browser |
| Ikon PWA tidak tampil | Manifest menunjuk `/uploads/logo.png`, sedangkan unggahan disimpan sesuai ekstensi asli (`logo.jpg`, `logo.webp`, dst.) | Unggah logo berformat **PNG**, atau ubah `src` di kedua manifest |
| Grafik harian bergeser satu hari | Zona waktu server ≠ database | Samakan ke `Asia/Jakarta` |
