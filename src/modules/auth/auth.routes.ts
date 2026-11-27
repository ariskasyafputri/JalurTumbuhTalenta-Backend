import { Router } from 'express';
import { ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { execute, pool, queryOne } from '../../config/db';
import { authenticate, getUserWithCompanies } from '../../middleware/auth';
import { hashPassword, signToken, verifyPassword } from '../../utils/auth';
import { asyncHandler, HttpError } from '../../utils/http';

const router = Router();

const email = z.string().trim().email('Format email tidak valid').max(160).transform((s) => s.toLowerCase());
const password = z.string().min(8, 'Password minimal 8 karakter').max(100);

const registerCandidateSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
  email,
  password,
});

const registerCompanySchema = z.object({
  name: z.string().trim().min(2, 'Nama PIC minimal 2 karakter').max(120),
  email,
  password,
  companyName: z.string().trim().min(2, 'Nama perusahaan minimal 2 karakter').max(160),
  industry: z.string().trim().max(120).optional(),
  npwp: z.string().trim().max(30).optional(),
  nib: z.string().trim().max(30).optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  detailAddress: z.string().trim().max(1000).optional(),
  website: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().url('URL website tidak valid').max(255).optional()),
  phone: z.string().trim().max(30).optional(),
  description: z.string().trim().max(5000).optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi'),
  portal: z.enum(['public', 'admin', 'super_admin']).optional(),
});

// Register Kandidat + otomatis buat baris kosong di candidate_profiles
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerCandidateSchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [data.email])) {
      throw new HttpError(409, 'Email sudah terdaftar');
    }

    const conn = await pool.getConnection();
    let userId: number;
    try {
      await conn.beginTransaction();
      const [u] = await conn.query<ResultSetHeader>(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'candidate')",
        [data.name, data.email, await hashPassword(data.password)]
      );
      userId = u.insertId;
      await conn.query('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const user = await getUserWithCompanies(userId);
    res.status(201).json({ token: signToken(userId), user });
  })
);

// Register Perusahaan: membuat company + user (role company) + relasi di company_members
router.post(
  '/register-company',
  asyncHandler(async (req, res) => {
    const d = registerCompanySchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email])) {
      throw new HttpError(409, 'Email sudah terdaftar');
    }

    const passwordHash = await hashPassword(d.password);
    const conn = await pool.getConnection();
    let userId: number;
    try {
      await conn.beginTransaction();
      const [c] = await conn.query<ResultSetHeader>(
        `INSERT INTO companies (name, industry, npwp, nib, province_id, detail_address, website, phone, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.companyName,
          d.industry ?? null,
          d.npwp ?? null,
          d.nib ?? null,
          d.provinceId ?? null,
          d.detailAddress ?? null,
          d.website ?? null,
          d.phone ?? null,
          d.description ?? null,
        ]
      );
      const [u] = await conn.query<ResultSetHeader>(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'company')",
        [d.name, d.email, passwordHash]
      );
      userId = u.insertId;
      await conn.query(
        "INSERT INTO company_members (user_id, company_id, member_role) VALUES (?, ?, 'owner')",
        [userId, c.insertId]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const user = await getUserWithCompanies(userId);
    res.status(201).json({ token: signToken(userId), user });
  })
);

// Login (mendukung pengecekan portal khusus /admin dan /superadmin)
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, portal } = loginSchema.parse(req.body);
    const rawUser = await queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!rawUser || !(await verifyPassword(password, rawUser.password_hash))) {
      throw new HttpError(401, 'Email atau password salah');
    }
    if (!rawUser.is_active) {
      throw new HttpError(403, 'Akun dinonaktifkan oleh administrator');
    }
    if (portal === 'admin' && rawUser.role !== 'admin') {
      throw new HttpError(403, 'Akun ini bukan akun Admin');
    }
    if (portal === 'super_admin' && rawUser.role !== 'super_admin') {
      throw new HttpError(403, 'Akun ini bukan akun Super Admin');
    }

    const user = await getUserWithCompanies(rawUser.id);
    res.json({ token: signToken(rawUser.id), user });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
