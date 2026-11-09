# 🔌 Dokumentasi API CATY

Semua endpoint ada di bawah `/api/`. Dokumen ini dibuat dari kode `index.js`.

## Daftar Isi

- [Konvensi Umum](#konvensi-umum)
- [Endpoint Publik](#endpoint-publik)
- [Autentikasi Admin](#autentikasi-admin)
- [Dashboard dan Laporan](#dashboard-dan-laporan)
- [Konfigurasi dan Tema](#konfigurasi-dan-tema)
- [Provider AI](#provider-ai)
- [Buku Pengetahuan](#buku-pengetahuan)
- [Knowledge Graph](#knowledge-graph)
- [RAG](#rag)
- [Memori AI](#memori-ai)
- [Tak Terjawab dan Learning Queue](#tak-terjawab-dan-learning-queue)
- [Pipeline Belajar Terpadu](#pipeline-belajar-terpadu)
- [Feedback](#feedback)
- [Ringkasan (Summary)](#ringkasan-summary)
- [Sesi dan Notifikasi](#sesi-dan-notifikasi)
- [Logo dan Keamanan](#logo-dan-keamanan)
- [Backup](#backup)
- [Rate Limit dan Kode Status](#rate-limit-dan-kode-status)

---

## Konvensi Umum

- Body request: JSON (`Content-Type: application/json`), maksimal 5 MB. Kecuali endpoint unggah file (`multipart/form-data`).
- Endpoint bertanda 🔒 butuh login admin: cookie `admin_token` **atau** header `Authorization: Bearer <token>`.
- Pola respons umum: `{ "success": true, ... }` atau `{ "success": false, "message": "..." }`. Untuk token tidak valid: HTTP `401`.
- Beberapa endpoint admin mengembalikan `200` dengan `success: false` untuk kesalahan validasi, bukan kode 4xx. Selalu cek field `success`.
- Endpoint yang menerima `index` (provider, memori) memakai **posisi dalam daftar**, bukan ID basis data. Muat ulang daftar setelah menambah atau menghapus.

> Bentuk respons rinci tidak saya verifikasi untuk setiap endpoint. Tabel di bawah menjelaskan parameter dan fungsi yang terlihat di kode. Gunakan DevTools browser pada dashboard untuk melihat contoh respons nyata.

---

## Endpoint Publik

### `POST /api/chat`

Kirim pertanyaan warga. Respons **streaming SSE**.

| Field body | Tipe | Wajib | Keterangan |
|---|---|:---:|---|
| `message` | string | ✅ | 1–2000 karakter |
| `sessionId` | string | – | Kosong untuk sesi baru |

Contoh:

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Apa syarat membuat KTP baru?"}'
```

Contoh aliran respons:

```
data: {"sessionId":"sess_1730000000000_ab12cd34"}

data: {"meta":{"source":"ai","context":6,"confidence":70}}

data: {"meta":{"provider":"Google Gemini","model":"gemini-2.0-flash","source":"ai"}}

data: {"delta":"Syarat buat KTP baru:\n• Fotokopi KK"}

data: {"delta":"\n• Fotokopi Akta Kelahiran..."}

data: {"done":true}
```

Nilai `meta.source`: `redirect`, `memory`, atau `ai`. Penjelasan semua objek event ada di [ARSITEKTUR.md](ARSITEKTUR.md#format-event-sse).

Kesalahan: `400` (`Pesan kosong` / `Pesan maksimal 2000 karakter`), `429` (rate limit).

### `POST /api/feedback`

Kirim rating jawaban.

| Field | Tipe | Wajib | Keterangan |
|---|---|:---:|---|
| `question` | string | ✅ | Dipotong 500 karakter |
| `answer` | string | ✅ | Dipotong 1000 karakter |
| `rating` | string | ✅ | `good` atau `bad` |
| `sessionId`, `provider`, `model`, `source` | string | – | Metadata |

Respons: `{ "success": true }`. Kesalahan validasi: `400 { "error": "Data tidak valid" }`.

> Dengan `USE_DB=false`, endpoint ini menjawab sukses tetapi tidak menyimpan apa pun.

### `GET /api/config/public`

Konfigurasi untuk halaman warga: `aiName`, `tagline`, `logoUrl`, `logoSize`, `theme`, `themeApplyToWarga`, `darkMode`, `welcomeMessage`, `quickButtons`, `surveyLink`, `surveyEnabled`, `surveyIdleMinutes`.

### `GET /api/topics`

Daftar topik yang terdeteksi dari buku pengetahuan: `{ "topics": [{ "title", "source" }] }`.

### `GET /api/health`

Status server: `status`, `uptime`, `providers`, `knowledgeChunks`, `topics`, `memory`, `sessions`, `unanswered`, `graph` (node/edge), `rag` (BM25, embedding, cache), `roles`.

> Endpoint ini publik. Jika tidak ingin menampilkan jumlah data internal, batasi dengan Nginx atau tambahkan `authAdmin`.

---

## Autentikasi Admin

### `POST /api/admin/login`

Dibatasi **10 percobaan gagal per 15 menit**.

```json
{ "username": "admin", "password": "PasswordKuat!" }
```

Sukses: `{ "success": true, "token": "<jwt>" }` dan cookie `admin_token` (`httpOnly`, 30 hari). Gagal: `401 { "success": false, "message": "Username atau password salah" }`.

### `POST /api/admin/logout` 🔒
Menghapus cookie.

### `GET /api/admin/check`
Cek sesi login: `{ "authenticated": true, "username": "admin", "token": "..." }` atau `{ "authenticated": false }`.

### `POST /api/admin/change-password` 🔒

```json
{ "oldPassword": "...", "newPassword": "minimal8karakter" }
```

Menulis hash baru ke `.env` (`ADMIN_PASSWORD_HASH`). **Restart server** agar konsisten. Memerlukan izin tulis ke `.env`.

---

## Dashboard dan Laporan

### `GET /api/admin/dashboard/stats` 🔒

| Query | Nilai | Default |
|---|---|---|
| `period` | `1d`, `7d`, `30d`, `90d`, `1y` | `7d` |

Berisi ringkasan, aktivitas harian, distribusi sumber jawaban, tren feedback, topik populer, kategori, dan kesehatan provider.

### Laporan 🔒

Semua menerima `from` dan `to` (format `YYYY-MM-DD`). Default: 30 hari terakhir.

| Endpoint | Query tambahan | Isi |
|---|---|---|
| `GET /api/admin/report/summary` | – | Ringkasan lengkap untuk halaman Laporan dan PDF |
| `GET /api/admin/report/sessions` | `limit` (default 100) | Daftar sesi |
| `GET /api/admin/report/unanswered` | – | Pertanyaan tak terjawab |
| `GET /api/admin/report/feedback` | `rating` (`good`/`bad`) | Daftar feedback |
| `GET /api/admin/report/export` | `type` (default `sessions`) | **Unduhan CSV** (belum ada tombolnya di dashboard) |

```bash
curl -b cookies.txt "http://localhost:3000/api/admin/report/export?type=sessions&from=2026-10-01&to=2026-10-31" -o laporan.csv
```

PDF dibuat di browser (jsPDF), bukan di server.

---

## Konfigurasi dan Tema

### `GET /api/admin/config` 🔒
Seluruh konfigurasi + daftar provider (API key **dimasking**: 8 karakter awal + `...` + 6 karakter akhir), daftar file pengetahuan, dan statistik (chunk, memori, sesi, notifikasi, graph, RAG, role).

### `POST /api/admin/config` 🔒
Mengubah konfigurasi. **Hanya kunci berikut yang diterima**; kunci lain diabaikan:

`aiName`, `tagline`, `logoUrl`, `logoSize`, `theme`, `welcomeMessage`, `systemInstruction`, `quickButtons`, `memoryEnabled`, `memoryMinScore`, `memorySaveThreshold`, `conversationHistoryEnabled`, `conversationHistorySize`, `rateLimitPerSession`, `contactInfo`, `strictMode`, `surveyLink`, `surveyEnabled`, `surveyIdleMinutes`, `themeApplyToWarga`, `darkMode`.

Objek `theme` digabung (*merge*) dengan tema yang ada. Contoh:

```json
{
  "aiName": "CATY",
  "tagline": "CHAT AI TEGALREJO YOGYAKARTA",
  "theme": { "primary": "#0d47a1", "accent": "#ec4899" },
  "quickButtons": [{ "label": "Syarat KTP", "question": "Apa syarat membuat KTP baru?" }]
}
```

> Setiap item `quickButtons` berbentuk `{ "label": "teks tombol", "question": "pertanyaan yang dikirim" }` (sesuai `loadPublicConfig` di `script.js`).

### `GET /api/admin/theme` 🔒
Mengembalikan `theme`, `themeApplyToWarga`, `darkMode`.

---

## Provider AI

Semua 🔒. Provider diidentifikasi dengan `index` (posisi dalam daftar).

| Endpoint | Body | Fungsi |
|---|---|---|
| `POST /api/admin/providers/add` | `name`, `apiKey`, `models`, `embeddingModels`, `customEndpoint`, `displayName`, `roles` | Tambah provider. `name` harus salah satu provider bawaan, **atau** isi `customEndpoint` (OpenAI-compatible) |
| `POST /api/admin/providers/remove` | `index` | Hapus |
| `POST /api/admin/providers/toggle` | `index` | Aktif/nonaktif |
| `POST /api/admin/providers/update-key` | `index`, `apiKey` | Ganti API key |
| `POST /api/admin/providers/update-models` | `index`, `models`, `embeddingModels` | Ganti daftar model |
| `POST /api/admin/providers/update-roles` | `index`, `roles` | Ganti peran |
| `POST /api/admin/providers/test` | `index`, `type` (`chat`/`embedding`) | Uji koneksi |
| `GET /api/admin/providers/roles-stats` | – | Jumlah provider per peran |

Peran yang valid: `chat`, `embedding`, `enrichment`, `query-rewriter`. Nilai tidak valid dibuang; jika kosong menjadi `["chat"]`.

Contoh menambah provider bawaan:

```json
{
  "name": "groq",
  "apiKey": "gsk_xxxxxxxxxxxxxxxx",
  "roles": ["chat", "enrichment"]
}
```

Contoh provider kustom:

```json
{
  "name": "my-llm",
  "displayName": "LLM Lokal",
  "apiKey": "sk-xxxx",
  "customEndpoint": "https://llm.contoh.id/v1",
  "models": ["nama-model"],
  "roles": ["chat"]
}
```

Nama provider bawaan: `gemini`, `groq`, `openrouter`, `cerebras`, `together`, `mistral`, `deepseek`, `fireworks`, `xai`.

---

## Buku Pengetahuan

Semua 🔒. Nama file diproses dengan `path.basename` dan disanitasi.

| Endpoint | Input | Fungsi |
|---|---|---|
| `POST /api/admin/knowledge/upload` | form-data `file` (`.md`/`.txt`, maks. 5 MB) | Unggah lalu muat ulang |
| `GET /api/admin/knowledge/content` | query `name` | Baca isi file |
| `POST /api/admin/knowledge/save` | `name`, `content` | Simpan hasil edit |
| `POST /api/admin/knowledge/delete` | `name` | Hapus file |
| `POST /api/admin/knowledge/reload` | – | Baca ulang semua file, bangun ulang indeks |

---

## Knowledge Graph

Semua 🔒.

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/graph/stats` | – | Jumlah node dan edge |
| `POST /api/admin/graph/save` | – | Simpan ke disk sekarang |
| `POST /api/admin/graph/rebuild` | – | Kosongkan lalu bangun ulang dari pengetahuan |
| `GET /api/admin/graph/query` | `q` | Uji konteks graph untuk suatu pertanyaan |
| `GET /api/admin/graph/visualize` | `limit` (300), `minDegree` (1) | Data node dan edge untuk vis-network |
| `GET /api/admin/graph/node/:id` | – | Detail satu node dan tetangganya |
| `POST /api/admin/graph/enrich` | `maxChunks` (30), `concurrency` (2) | Mulai pengayaan via LLM (latar belakang) |
| `GET /api/admin/graph/enrich/status` | – | Progres pengayaan |

Hanya satu proses enrich yang boleh berjalan; permintaan kedua dijawab `success: false`.

---

## RAG

| Endpoint | Fungsi |
|---|---|
| `GET /api/admin/rag/stats` 🔒 | Statistik BM25, embedding, cache, rewrite |
| `POST /api/admin/rag/rebuild` 🔒 | Bangun ulang indeks BM25 + embedding |

---

## Memori AI

Semua 🔒.

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/memory` | – | Daftar memori |
| `GET /api/admin/memory/:index` | – | Satu item |
| `POST /api/admin/memory/update` | `index`, `question`, `answer`, `variants`, `keywords` | Ubah |
| `POST /api/admin/memory/delete` | `index` | Hapus satu |
| `POST /api/admin/memory/clear` | – | Hapus semua |
| `POST /api/admin/memory/reload` | – | Muat ulang dari penyimpanan |

---

## Tak Terjawab dan Learning Queue

### Tak Terjawab (`unanswered.json`) 🔒

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/unanswered` | – | Daftar |
| `POST /api/admin/unanswered/resolve` | `id` | Tandai selesai |
| `POST /api/admin/unanswered/delete` | `id` | Hapus |
| `POST /api/admin/unanswered/clear` | `onlyResolved` (boolean) | Hapus yang selesai, atau semuanya |

### Learning Queue (PostgreSQL) 🔒

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/learning/queue` | query `filter`: `all`, `pending`, `urgent`, `high` | Daftar berurut prioritas |
| `GET /api/admin/learning/stats` | – | `total`, `pending`, `resolved`, `urgent`, `high`, `medium` |
| `POST /api/admin/learning/resolve` | `id` | Tandai selesai |
| `POST /api/admin/learning/delete` | `id` | Hapus |
| `POST /api/admin/learning/clear-resolved` | – | Hapus yang selesai |
| `POST /api/admin/learning/clear-all` | – | Hapus semua |

---

## Pipeline Belajar Terpadu

### `POST /api/admin/unified/add-to-knowledge` 🔒

Satu panggilan: simpan ke pengetahuan, update graph, enrich, tandai selesai, reload.

| Field | Tipe | Wajib | Keterangan |
|---|---|:---:|---|
| `question` | string | ✅ | Teks pertanyaan |
| `answer` | string | ✅ | Jawaban lengkap dari admin |
| `id` | string | – | ID item di antrean |
| `source` | string | – | `unanswered` atau `learning`, menentukan antrean yang ditandai selesai |
| `category` | string | – | Kategori |

Respons memuat `steps` (apa yang berhasil) dan `errors`. Lihat [ARSITEKTUR.md](ARSITEKTUR.md#8-pipeline-belajar-terpadu).

---

## Feedback

Semua 🔒 kecuali pengiriman rating (lihat Endpoint Publik).

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/feedback/stats` | query `days` | Statistik + tren harian |
| `GET /api/admin/feedback/list` | – | Semua feedback terbaru |
| `GET /api/admin/feedback/bad` | – | Contoh rating buruk |
| `GET /api/admin/feedback/good` | – | Contoh rating baik |
| `POST /api/admin/feedback/clear` | `analytics` (boolean) | Hapus feedback; jika `true`, hapus juga analytics |

---

## Ringkasan (Summary)

Semua 🔒.

| Endpoint | Fungsi |
|---|---|
| `GET /api/admin/summary/latest` | Ringkasan terbaru |
| `GET /api/admin/summary/list` | Daftar ringkasan |
| `GET /api/admin/summary/knowledge` | Topik-topik buku pengetahuan |
| `POST /api/admin/summary/generate` | Buat insight harian sekarang |

---

## Sesi dan Notifikasi

Semua 🔒.

| Endpoint | Input | Fungsi |
|---|---|---|
| `GET /api/admin/sessions` | – | Daftar sesi aktif |
| `GET /api/admin/sessions/:id` | – | Isi percakapan satu sesi |
| `POST /api/admin/sessions/clear` | – | **Hapus semua sesi** (warga yang sedang chat kehilangan riwayat) |
| `GET /api/admin/notifications` | – | Daftar |
| `POST /api/admin/notifications/read` | `id` (kosong = semua) | Tandai dibaca |
| `POST /api/admin/notifications/clear` | – | Hapus semua |

Notifikasi disimpan maksimal 100 item.

---

## Logo dan Keamanan

| Endpoint | Input | Fungsi |
|---|---|---|
| `POST /api/admin/logo/upload` 🔒 | form-data `logo` (PNG/JPG/GIF/WebP/SVG, maks. 2 MB) | Unggah logo ke `public/uploads/` |
| `POST /api/admin/logo/delete` 🔒 | – | Hapus logo |

Perubahan password: lihat [Autentikasi Admin](#autentikasi-admin).

---

## Backup

Semua 🔒.

| Endpoint | Input | Fungsi |
|---|---|---|
| `POST /api/admin/backup` | – | Buat backup sekarang |
| `GET /api/admin/backups` | – | Daftar file backup |
| `GET /api/admin/backup/download/:filename` | – | Unduh file `*.zip.enc` |
| `POST /api/admin/backup/restore` | form-data `backup` (file `.zip.enc`) | Pulihkan; **restart server** setelahnya |

Restore membuat salinan pengaman file yang ditimpa di `tmp/pre_restore_<timestamp>/`. Detail dan batasannya: [DEPLOYMENT.md](DEPLOYMENT.md#backup--restore).

---

## Rate Limit dan Kode Status

| Cakupan | Batas |
|---|---|
| Semua `/api/*` | 500 permintaan / 15 menit |
| `POST /api/chat` | 20 / menit per `sessionId` (jika tanpa sesi: per IP) |
| `POST /api/admin/login` | 10 gagal / 15 menit (percobaan sukses tidak dihitung) |

| Kode | Arti |
|---|---|
| `200` | Berhasil (cek juga `success`) |
| `400` | Input tidak valid |
| `401` | Belum login / token tidak valid |
| `404` | File atau item tidak ditemukan; juga untuk path sensitif yang diblokir |
| `429` | Terlalu banyak permintaan |
| `500` | Kesalahan server |

Di balik proxy (Nginx), server memakai `trust proxy = 1` agar IP klien terbaca dengan benar dari `X-Forwarded-For`.
