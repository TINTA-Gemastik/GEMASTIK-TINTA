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
Buat file `.env.local` di root folder dan isi dengan kredensial Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Supabase (Database & Auth)
Ikuti langkah-langkah berikut untuk mengatur database Anda:

1.  **Eksekusi Skema:** Buka SQL Editor di Dashboard Supabase, salin dan jalankan isi dari [docs/schema.sql](docs/schema.sql).
2.  **Setup Trigger Auth:** Jalankan SQL berikut di SQL Editor agar profil user otomatis terbuat saat registrasi:
    ```sql
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 
        COALESCE(NEW.raw_user_meta_data->>'role', 'mahasiswa')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE OR REPLACE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    ```

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

