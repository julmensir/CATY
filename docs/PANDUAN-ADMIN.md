# 👩‍💼 Panduan Admin CATY

Panduan untuk petugas Kemantren yang mengelola CATY lewat dashboard. Tidak perlu kemampuan pemrograman.

## Daftar Isi

1. [Masuk ke Dashboard](#1-masuk-ke-dashboard)
2. [Pengaturan Awal (Sekali Saja)](#2-pengaturan-awal-sekali-saja)
3. [Rutinitas Harian](#3-rutinitas-harian)
4. [Menambah Provider AI](#4-menambah-provider-ai)
5. [Mengelola Buku Pengetahuan](#5-mengelola-buku-pengetahuan)
6. [Menjawab Pertanyaan yang Belum Terjawab](#6-menjawab-pertanyaan-yang-belum-terjawab)
7. [Memori AI](#7-memori-ai)
8. [Knowledge Graph](#8-knowledge-graph)
9. [Membaca Dashboard dan Laporan](#9-membaca-dashboard-dan-laporan)
10. [Identitas, Tema, dan Prompt](#10-identitas-tema-dan-prompt)
11. [Backup dan Keamanan](#11-backup-dan-keamanan)
12. [Tips Menulis Pengetahuan yang Baik](#12-tips-menulis-pengetahuan-yang-baik)
13. [Pertanyaan Umum](#13-pertanyaan-umum)

---

## 1. Masuk ke Dashboard

1. Buka `https://<alamat-situs>/admin/`.
2. Masukkan **username** dan **password** admin.
3. Setelah masuk, sesi bertahan hingga 30 hari di perangkat tersebut.

Jika salah memasukkan password 10 kali berturut-turut, login dikunci selama 15 menit.

Dashboard bisa dipasang seperti aplikasi: buka di Chrome/Edge lalu pilih **Pasang / Install** (atau *Add to Home Screen* di HP).

---

## 2. Pengaturan Awal (Sekali Saja)

Lakukan berurutan:

- [ ] **Provider AI**: tambahkan minimal satu provider dengan peran `chat` ([bagian 4](#4-menambah-provider-ai)). Tanpa ini CATY tidak bisa menjawab.
- [ ] **Buku Pengetahuan**: unggah atau tulis isi layanan Kemantren ([bagian 5](#5-mengelola-buku-pengetahuan)).
- [ ] **Identitas**: isi nama, tagline, logo, dan **kontak resmi** (alamat, telepon, WhatsApp, jam layanan).
- [ ] **Prompt AI**: ganti nomor kontak contoh di dalam *System Prompt* dengan nomor resmi.
- [ ] **Keamanan**: ganti password admin.
- [ ] **Backup**: jalankan backup manual sekali, pastikan berhasil.
- [ ] Uji lewat halaman warga (`/`): tanyakan beberapa pertanyaan nyata dan lihat hasilnya.

> ⚠️ **Wajib:** ganti nomor telepon/WhatsApp contoh di System Prompt. Jika tidak, CATY akan memberi warga nomor yang salah saat tidak bisa menjawab.

---

## 3. Rutinitas Harian

Cukup 5–10 menit per hari:

| Langkah | Menu | Tujuan |
|---|---|---|
| 1 | **Dashboard** | Lihat jumlah chat, kepuasan, dan apakah ada provider bermasalah |
| 2 | **Notifikasi** | Baca peringatan (mis. semua provider gagal) |
| 3 | **Tak Terjawab** | Jawab pertanyaan yang paling sering ditanyakan |
| 4 | **Feedback & Akurasi** | Periksa jawaban yang diberi 👎 |

Mingguan: lihat **Laporan** dan unduh PDF untuk arsip atau pelaporan. Bulanan: periksa folder backup.

---

## 4. Menambah Provider AI

**Provider AI** adalah layanan yang menghasilkan jawaban. Anda butuh **API key** dari penyedia layanan tersebut (beberapa punya paket gratis, misalnya Google Gemini dan Groq).

**Langkah:**
1. Buka **Provider AI → Semua Provider**.
2. Isi **nama provider**, tempel **API key**, lalu pilih **peran**.
3. Simpan, lalu klik **Test** untuk memastikan berfungsi.

**Peran provider:**

| Peran | Gunakan untuk |
|---|---|
| `chat` | Menjawab warga. **Wajib ada minimal satu.** |
| `embedding` | Pencarian makna (semantik). Meningkatkan akurasi pencarian. Didukung Gemini, Mistral, Together |
| `enrichment` | Memperkaya Knowledge Graph dan pipeline belajar |
| `query-rewriter` | Terdaftar, tetapi saat ini penulisan ulang pertanyaan memakai provider `chat` |

Satu provider boleh punya beberapa peran.

**Saran konfigurasi:**
- Pasang **2–3 provider `chat`** sebagai cadangan. Jika yang pertama kehabisan kuota, CATY otomatis pindah ke berikutnya. **Urutan dalam daftar = urutan prioritas.**
- Aktifkan `embedding` pada satu provider agar pencarian lebih pintar.

**Tombol per provider:** aktif/nonaktif, ganti API key, ganti model, hapus, dan Test.

**Provider kustom:** untuk layanan lain yang kompatibel dengan OpenAI, isi **Custom Endpoint** (mis. `https://llm.contoh.id/v1`) dan nama model.

> 🔐 API key disimpan terenkripsi dan hanya tampil sebagian. Jangan membagikannya lewat WhatsApp atau email.

**Jika Test gagal:**
- `401` → API key salah.
- `404` → nama model tidak tersedia; ganti lewat **Edit Model**.
- `429` → kuota habis; tunggu atau pakai provider lain.

---

## 5. Mengelola Buku Pengetahuan

Buku Pengetahuan adalah **satu-satunya sumber jawaban** CATY. Isinya menentukan kualitas layanan.

**Aksi yang tersedia:**
- **Unggah** file `.md` atau `.txt` (maks. 5 MB)
- **Edit** langsung di dashboard
- **Hapus** file
- **Reload** untuk memuat ulang setelah file diubah di server

Setiap perubahan lewat dashboard langsung dimuat dan indeks pencarian dibangun ulang.

**Format yang disarankan** (satu topik per judul):

```markdown
## Syarat Pembuatan Akta Kelahiran

Kata kunci : akta kelahiran, akte lahir, buat akta anak

Pertanyaan : Apa saja syarat membuat akta kelahiran?

Jawaban : Syarat akta kelahiran:
• Surat keterangan lahir dari bidan/rumah sakit
• Fotokopi KK
• KTP kedua orang tua
• Buku nikah orang tua
Biaya: gratis.

Kategori : Administrasi
```

Aturan singkat:
- Gunakan judul `##` untuk memisahkan topik.
- Tulis **syarat lengkap**; CATY akan menyebut semuanya apa adanya.
- Isi `Kata kunci` dengan istilah yang dipakai warga, termasuk singkatan dan ejaan lain (*akta/akte*, *KTP/KTP-el*).
- Hindari satu file raksasa tanpa judul. Chunk yang fokus memberi hasil lebih akurat.

---

## 6. Menjawab Pertanyaan yang Belum Terjawab

Menu **Tak Terjawab** adalah cara terbaik membuat CATY makin pintar. Isinya pertanyaan warga yang tidak bisa dijawab atau dianggap di luar topik.

**Langkah:**
1. Buka **Tak Terjawab**. Urutkan perhatian ke yang paling sering ditanyakan (**urgent** dan **high** lebih dulu).
2. Klik **Tambah Jawaban** pada sebuah pertanyaan.
3. Tulis jawaban **lengkap dan resmi**, pilih kategori, lalu kirim.

**Yang terjadi otomatis** setelah Anda mengirim:
1. Jawaban ditambahkan ke Buku Pengetahuan.
2. Knowledge Graph diperbarui.
3. Pertanyaan ditandai selesai (di Tak Terjawab dan Learning Queue).
4. Indeks pencarian dimuat ulang.

Warga berikutnya yang bertanya hal serupa langsung mendapat jawaban Anda.

**Pertanyaan yang tidak perlu dijawab** (spam, di luar urusan Kemantren) cukup **dihapus** atau ditandai selesai.

**Membersihkan:** tersedia tombol **Hapus yang Selesai** dan **Hapus Semua**.

---

## 7. Memori AI

Memori menyimpan jawaban yang sudah terbukti agar pertanyaan yang sama dijawab **instan dan tanpa biaya**. Memori terisi otomatis dari percakapan.

**Menu Memori AI** memungkinkan Anda:
- Melihat daftar, jumlah pemakaian (*hit*), dan variasi pertanyaan
- **Mengubah** pertanyaan, jawaban, dan kata kunci
- **Menghapus** satu item atau semuanya

**Kapan perlu membersihkan memori?** Jika Anda **mengubah informasi resmi** (mis. biaya atau syarat berubah), memori lama bisa masih memberi jawaban lama. Ubah atau hapus item memori terkait setelah memperbarui Buku Pengetahuan.

**Pengaturan** (menu Prompt AI / pengaturan memori):

| Pengaturan | Default | Arti |
|---|--:|---|
| Memori aktif | ya | Matikan untuk selalu menjawab dari pengetahuan terbaru |
| Skor minimum (`memoryMinScore`) | 75 | Makin tinggi, makin ketat. Naikkan jika memori sering salah mencocokkan |
| Ambang simpan (`memorySaveThreshold`) | 55 | Seberapa mirip pertanyaan agar digabung ke memori lama |

---

## 8. Knowledge Graph

Graph memetakan hubungan antar konsep (mis. "akta kelahiran" → *memerlukan* → "kartu keluarga") sebagai konteks tambahan bagi AI.

- **Visualisasi:** buka **Knowledge Graph**; klik sebuah node untuk melihat detail dan tetangganya.
- **Enrich:** meminta AI mengekstrak relasi baru dari buku pengetahuan. Memakai kuota API; mulai dari 30 chunk. Hanya satu proses berjalan sekaligus, progres bisa dipantau.
- **Rebuild:** membangun ulang dari nol dari buku pengetahuan. Hasil enrich sebelumnya hilang; gunakan jika graph terlihat berantakan.
- **Simpan:** graph otomatis tersimpan tiap menit; tombol simpan memaksa penyimpanan segera.

Graph bersifat pelengkap. Jika tidak dipakai pun, CATY tetap menjawab dari Buku Pengetahuan.

---

## 9. Membaca Dashboard dan Laporan

### Dashboard

Pilih periode: **1 hari, 7 hari, 30 hari, 90 hari, 1 tahun**.

| Bagian | Arti |
|---|---|
| Aktivitas harian | Jumlah pesan per hari |
| Sumber jawaban | **Memori** (instan), **RAG** (dari pengetahuan, yakin tinggi), **AI** (jawaban lainnya), **Penolakan** (tidak ada di buku), **Pengalihan** (di luar topik) |
| Tren feedback | 👍 dan 👎 per hari |
| Topik populer | Pertanyaan yang paling sering muncul |
| Kategori | Administrasi, Layanan Sosial, Kesehatan, Pendidikan, Pajak & Retribusi, Perizinan, Pengaduan, Lainnya |
| Kesehatan provider | Provider yang aktif/bermasalah |

**Cara membaca cepat:**
- **Penolakan tinggi** → banyak pertanyaan yang belum ada di buku. Isi lewat Tak Terjawab.
- **Pengalihan tinggi** → warga menanyakan hal di luar layanan. Pertimbangkan menambah informasi atau menyesuaikan sambutan.
- **Banyak 👎** → periksa jawaban terkait di **Feedback & Akurasi**.

> Statistik, feedback, dan antrean belajar hanya tercatat jika sistem memakai PostgreSQL. Jika semuanya 0 padahal ada percakapan, hubungi pengelola server.

### Laporan

1. Buka **Laporan** dan pilih rentang (preset atau kustom).
2. Tinjau ringkasan, grafik, topik teratas, pengetahuan, memori, provider, sesi, feedback, dan tak terjawab.
3. **Cetak PDF** untuk laporan resmi: pratinjau dulu, lalu unduh.
4. **Print** untuk mencetak langsung dari browser.
5. Tombol **Refresh** memuat ulang data laporan.

> Ekspor CSV tersedia lewat API (`/api/admin/report/export`) tetapi belum ada tombolnya di dashboard. Minta pengelola teknis jika membutuhkannya.

---

## 10. Identitas, Tema, dan Prompt

### Identitas
Nama AI, tagline, logo (PNG, maks. 2 MB; **gunakan PNG** agar ikon aplikasi muncul), ukuran logo, pesan sambutan, kontak resmi, tombol pertanyaan cepat, dan survei kepuasan.

- **Tombol cepat:** tiap tombol punya *label* (teks di tombol) dan *pertanyaan* (yang dikirim saat diklik). Pilih pertanyaan yang paling sering ditanyakan warga.
- **Survei:** isi tautan survei (Google Form, dsb.) dan atur berapa menit warga diam sebelum survei muncul.

### Tema
Atur warna utama, sidebar, dan aksen, serta mode terang/gelap. Opsi **Terapkan Tema ke Halaman Warga** menentukan apakah tema ikut mengubah tampilan warga. Tersedia pratinjau dan tombol reset.

### Prompt AI
Berisi instruksi perilaku CATY. **Ubah dengan hati-hati.**

Ketentuan penting:
- Jangan menghapus aturan "jawab hanya dari buku" kecuali Anda paham risikonya (AI bisa mengarang).
- Kalimat baku penolakan ("Wah, info itu belum ada di buku catatan SIVT nih...") dikenali sistem untuk mencatat pertanyaan ke **Tak Terjawab**. **Jika Anda mengubah kalimat itu, hubungi pengelola teknis** agar pengenalannya disesuaikan; kalau tidak, pertanyaan yang gagal dijawab tidak akan tercatat.
- Selalu ganti nomor kontak contoh dengan nomor resmi.

Pengaturan lain: jumlah riwayat percakapan yang diingat AI (default 20 pesan) dan batas chat per menit.

---

## 11. Backup dan Keamanan

### Backup
- Otomatis setiap hari pukul 02.00; sistem menyimpan beberapa yang terbaru.
- **Manual:** menu **Backup → Backup Sekarang**, lalu **Unduh** dan simpan di tempat lain (flashdisk, Google Drive, dsb.).
- **Restore:** unggah file `.zip.enc`, tunggu selesai, lalu **minta pengelola server me-restart aplikasi**. Data database dipulihkan terpisah oleh pengelola teknis.

> Backup hanya bisa dibuka dengan kunci enkripsi milik server. Pastikan pengelola teknis menyimpan kunci itu dengan aman.

### Ganti password
**Keamanan → Ganti Password.** Minimal 8 karakter. Gunakan kombinasi huruf, angka, dan simbol. Setelah diganti, minta pengelola me-restart aplikasi agar berlaku konsisten.

### Praktik baik
- Jangan berbagi akun admin. Jika petugas berganti, ganti password.
- Selalu **Keluar** (logout) dari komputer bersama.
- Jangan menempelkan API key di chat, email, atau dokumen publik.

---

## 12. Tips Menulis Pengetahuan yang Baik

1. **Satu topik, satu judul.** Jangan campur KTP dan KK dalam satu bagian.
2. **Lengkap dan pasti.** Tulis semua syarat, biaya, lama proses, dan lokasi loket.
3. **Gunakan bahasa warga.** Cantumkan kata lain yang sering dipakai (*akte*, *ktpel*, *surat pindah*).
4. **Beri tanggal jika berlaku sementara.** Misalnya "berlaku sampai Desember 2026".
5. **Tulis daftar dengan "•" atau angka.** CATY menampilkannya sebagai daftar rapi.
6. **Jangan menulis angka kontak berbeda-beda.** Tentukan satu nomor resmi, simpan di Identitas.
7. **Tinjau berkala.** Aturan layanan berubah; jadwalkan pengecekan tiap triwulan.
8. **Uji setelah mengubah.** Tanyakan sendiri di halaman warga untuk memastikan jawabannya sesuai.

---

## 13. Pertanyaan Umum

**CATY menjawab "belum ada di buku", padahal infonya ada.**
Kemungkinan kata kunci tidak cocok dengan cara warga bertanya. Tambahkan variasi di baris `Kata kunci`, dan aktifkan provider `embedding` bila belum.

**CATY memberi jawaban lama setelah saya memperbarui buku.**
Kemungkinan jawaban lama tersimpan di **Memori AI**. Ubah atau hapus item tersebut.

**Jawaban muncul sekaligus, tidak mengetik bertahap.**
Masalah pengaturan server (buffering). Sampaikan ke pengelola teknis.

**Semua provider gagal.**
Cek menu **Notifikasi** dan **Provider AI**: biasanya kuota habis atau API key salah. Klik **Test** pada tiap provider.

**Warga bertanya di luar layanan, lalu dialihkan.**
Itu perilaku normal. Jika pengalihan salah sasaran (pertanyaan layanan yang dianggap di luar topik), catat contoh kalimatnya dan sampaikan ke pengelola teknis untuk menyesuaikan daftar kata kunci.

**Apakah percakapan warga disimpan?**
Sesi disimpan sementara (hingga 2 jam tanpa aktivitas). Pertanyaan yang tidak terjawab, rating, dan statistik disimpan untuk perbaikan layanan. Pertimbangkan menyampaikan hal ini kepada warga sesuai kebijakan privasi instansi.

**Siapa yang dihubungi bila ada masalah teknis?**
Pengelola server/pengembang aplikasi. Siapkan tangkapan layar dan waktu kejadian.
