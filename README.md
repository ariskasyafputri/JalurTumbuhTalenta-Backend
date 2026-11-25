# ATS Backend (Node.js + TypeScript + MySQL)

## Setup
```bash
npm install
cp .env.example .env        # isi DB & JWT_SECRET
mysql -u root -p < sql/schema.sql
npm run seed:superadmin     # bikin akun super admin
npm run dev
```

## Role
| Role | Cara dapat akun | Bisa apa |
|---|---|---|
| candidate | `POST /api/auth/register` | login, lihat lowongan, melamar |
| company | `POST /api/auth/register-company` | kelola perusahaan, bikin rekrutmen, tambah admin, cari perusahaan |
| admin | dibuat oleh company / super admin | bikin & kelola rekrutmen perusahaannya, proses pelamar, cari perusahaan |
| super_admin | hanya seed script / super admin lain | kelola semua user, perusahaan, rekrutmen |

## Endpoint
Auth: `Authorization: Bearer <token>`

**Auth**
- POST /api/auth/register  `{name,email,password}`
- POST /api/auth/register-company  `{name,email,password,companyName,industry?,location?,website?,description?}`
- POST /api/auth/login  `{email,password}`
- GET  /api/auth/me

**Rekrutmen**
- GET  /api/recruitments  (publik: q, location, type, companyId, page, limit)
- GET  /api/recruitments/:id  (publik kalau open)
- GET  /api/recruitments/manage/list  (staff; semua status)
- POST /api/recruitments  (admin/company/super_admin)
- PATCH|DELETE /api/recruitments/:id
- GET  /api/recruitments/:id/applications

**Lamaran**
- POST   /api/applications/apply/:recruitmentId  (candidate) `{coverLetter?,resumeUrl?}`
- GET    /api/applications/me
- DELETE /api/applications/:id  (tarik lamaran)
- PATCH  /api/applications/:id/status  (staff) `{status}`

**Perusahaan** (company/admin/super_admin)
- GET /api/companies?q=&industry=&location=  <- tim rekrutmen cari perusahaan
- GET|PATCH /api/companies/:id
- GET|POST  /api/companies/:id/admins

**Super admin** (`/api/superadmin`)
- GET /stats, GET /applications
- GET|POST /users, GET|PATCH|DELETE /users/:id
- DELETE /companies/:id
