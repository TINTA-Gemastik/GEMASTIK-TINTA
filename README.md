# TINTA - Transparency in Academic Writing

TINTA adalah platform untuk memastikan transparansi dan integritas akademik dalam penulisan tugas mahasiswa.

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Database & Auth:** Supabase
- **Styling:** Tailwind CSS & Shadcn UI
- **Icons:** Lucide React

## Persiapan Proyek

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Variables
Buat file `.env.local` di root folder dan isi dengan kredensial Supabase Anda. Anda memerlukan **Service Role Key** untuk menjalankan skrip seeding:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Setup Database & Seeding
Ikuti langkah-langkah berikut untuk mengatur database Anda agar tidak terjadi error *Infinite Recursion* pada RLS:

1.  **Eksekusi Skema SQL:**
    - Buka **SQL Editor** di Dashboard Supabase.
    - Salin dan jalankan isi dari [docs/schema.sql](docs/schema.sql). 
    - *Note: Skema ini sudah menggunakan Security Definier Functions untuk mencegah RLS Infinite Recursion.*

2.  **Jalankan Scrip Seeding:**
    Pastikan `.env.local` sudah terisi dengan benar (terutama `SUPABASE_SERVICE_ROLE_KEY`), lalu jalankan:
    ```bash
    npm run db:seed
    ```
    Skrip ini akan secara otomatis:
    - Membuat akun Auth & Profile untuk Dosen (`dsn@app.com`) dan Mahasiswa (`mhs@app.com`).
    - Membuat data simulasi lengkap (Tasks, Sessions, Events, Submissions, hingga Anomaly Flags & Dosen Reviews).

---

### 4. Menjalankan Aplikasi
```bash
npm run dev
```
Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000).

---

## Struktur Folder Utama
- `/src/app`: Routes dan logic halaman (Next.js App Router)
- `/src/components`: Reusable UI components
- `/src/lib/supabase`: Konfigurasi client Supabase
- `/docs`: Dokumentasi skema database dan panduan lainnya
- `middleware.ts`: Role-based protection untuk dashboard Mahasiswa & Dosen

