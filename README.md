# Jalurtumbuh Jobs - Backend (Express + TypeScript + MySQL)

## Cara Menjalankan
1. Import database `sql/schema.sql` ke MySQL / phpMyAdmin.
2. Sesuaikan konfigurasi database di file `.env`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Buat akun default **Super Admin** dan **Admin**:
   ```bash
   npm run seed
   ```
   - Super Admin: `superadmin@jalurtumbuh.id` / `SuperAdmin123!`
   - Admin: `admin@jalurtumbuh.id` / `AdminJalur123!`
5. Jalankan server:
   ```bash
   npm run dev
   ```
