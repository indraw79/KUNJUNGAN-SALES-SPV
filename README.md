# Absensi Sales Lapangan — Panduan Deploy ke GitHub + Vercel

Paket ini berisi aplikasi yang sama dengan versi Claude, tapi sudah memakai
database sungguhan (Vercel KV) — jadi tidak lagi tergantung fitur penyimpanan
bawaan Claude yang sempat bermasalah.

Isi folder ini:
- `index.html` — aplikasi (tampilan + logika), tidak perlu diubah.
- `api/kv.js` — fungsi backend yang membaca/menulis data ke database.
- `package.json` — daftar dependensi (`@vercel/kv`).
- `.gitignore` — supaya file yang tidak perlu tidak ikut ter-upload.

Tidak perlu install apa pun di komputer Anda (tidak perlu Node.js, git, atau
command line). Semua langkah di bawah dilakukan lewat browser.

---

## Langkah 1 — Buat repository di GitHub

1. Buka [github.com](https://github.com) dan login.
2. Klik tombol hijau **"New"** (atau ikon **+** di pojok kanan atas → **New repository**).
3. Isi **Repository name**, misalnya `sales-tracker`.
4. Pilih **Private** (disarankan, karena ada data login di dalamnya nanti).
5. Klik **Create repository**.
6. Di halaman repo yang baru dibuat, klik **"uploading an existing file"**
   (tautan biru di tengah halaman).
7. Seret (drag & drop) ke-4 file dari paket ini — **kecuali folder `api`,
   upload dulu langsung, nanti buat folder `api` dengan cara di bawah**:
   - Upload dulu: `index.html`, `package.json`, `.gitignore`.
   - Klik **Commit changes**.
8. Untuk file di dalam folder `api/kv.js`: klik **Add file → Create new file**,
   di kolom nama file ketik `api/kv.js` (garis miring akan otomatis membuat
   folder), lalu salin-tempel isi file `api/kv.js` dari paket ini ke kotak
   editornya. Klik **Commit changes**.

Repository Anda sekarang punya semua file yang dibutuhkan.

---

## Langkah 2 — Hubungkan ke Vercel

1. Buka [vercel.com](https://vercel.com) dan login (bisa langsung pakai akun GitHub).
2. Klik **Add New... → Project**.
3. Pilih **Import Git Repository**, cari repo `sales-tracker` yang tadi dibuat, klik **Import**.
4. Biarkan pengaturan default (Framework Preset: **Other**), klik **Deploy**.
5. Tunggu proses selesai (biasanya 30–60 detik). Nanti akan gagal dulu di
   langkah ini karena database belum disiapkan — itu wajar, lanjut ke Langkah 3.

---

## Langkah 3 — Aktifkan Database (Vercel KV)

1. Di dashboard project Anda di Vercel, buka tab **Storage**.
2. Klik **Create Database → KV (Redis)**.
3. Beri nama (bebas, misalnya `sales-tracker-db`), klik **Create**.
4. Vercel akan menawarkan untuk **menghubungkan database ini ke project** —
   klik **Connect**/**Accept** (ini otomatis mengisi kredensial database ke
   project, Anda tidak perlu copy-paste apa pun).
5. Kembali ke tab **Deployments**, buka deployment terakhir, klik titik tiga
   (⋮) → **Redeploy** supaya project memakai database yang baru dihubungkan.

---

## Langkah 4 — Selesai

1. Buka tab **Deployments**, klik deployment paling atas yang statusnya
   **Ready**, lalu klik tombol **Visit** — ini alamat aplikasi Anda
   (bentuknya seperti `https://sales-tracker-xxxx.vercel.app`).
2. Buka alamat itu di browser. Halaman **"Buat akun Owner pertama"** akan muncul.
3. Ikuti proses seperti biasa: buat akun Owner, buat akun Sales/Supervisor,
   import CSV, dan seterusnya — semua fitur sama seperti versi sebelumnya.
4. Alamat ini yang dibagikan ke tim sales. Bisa juga ditambahkan **domain
   sendiri** nanti lewat tab **Settings → Domains** di Vercel kalau perlu.

---

## Catatan Penting

- **Data lama dari versi Claude tidak otomatis pindah** — karena
  penyimpanannya beda sistem. Perlu dibuat ulang akun Owner dan import ulang
  CSV sales di alamat Vercel yang baru (langkah cepat, sama seperti sebelumnya).
- Setelah ini berjalan di Vercel, aplikasi **tidak lagi butuh akun Claude
  berbayar** untuk penyimpanan data — sudah pakai database sendiri.
- Kalau nanti ingin mengembangkan fitur lagi, bisa kembali ke chat Claude ini,
  minta perubahan pada `index.html` atau `api/kv.js`, lalu upload ulang file
  yang berubah ke GitHub (Vercel akan otomatis deploy ulang setiap ada
  perubahan di GitHub).
