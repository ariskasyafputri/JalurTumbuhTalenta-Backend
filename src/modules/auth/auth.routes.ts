import { Router } from 'express';
import { z } from 'zod';
import { execute, pool, queryOne } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { hashPassword, signToken, verifyPassword } from '../../utils/auth';
import { asyncHandler, HttpError } from '../../utils/http';
import { ResultSetHeader } from 'mysql2/promise';

const router = Router();

const email = z.string().trim().email().max(255).transform((s) => s.toLowerCase());
const password = z.string().min(8, 'Password minimal 8 karakter').max(100);

const registerCandidateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
});

const registerCompanySchema = z.object({
  name: z.string().trim().min(2).max(100), // nama PIC / pemilik akun
  email,
  password,
  companyName: z.string().trim().min(2).max(150),
  industry: z.string().trim().max(100).optional(),
  location: z.string().trim().max(150).optional(),
  website: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().url().max(255).optional()),
  description: z.string().trim().max(5000).optional(),
});

const loginSchema = z.object({ email, password: z.string().min(1) });

const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  companyId: u.company_id ?? null,
});

// Register kandidat (tanpa verifikasi email). Role SELALU candidate.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerCandidateSchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [data.email]))
      throw new HttpError(409, 'Email sudah terdaftar');

    const r = await execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'candidate')",
      [data.name, data.email, await hashPassword(data.password)]
    );
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [r.insertId]);
    res.status(201).json({ token: signToken(r.insertId), user: publicUser(user) });
  })
);

// Register perusahaan: membuat data perusahaan + akun pemilik (role company)
router.post(
  '/register-company',
  asyncHandler(async (req, res) => {
    const d = registerCompanySchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email]))
      throw new HttpError(409, 'Email sudah terdaftar');

    const passwordHash = await hashPassword(d.password);
    const conn = await pool.getConnection();
    let userId: number;
    try {
      await conn.beginTransaction();
      const [c] = await conn.query<ResultSetHeader>(
        'INSERT INTO companies (name, industry, location, website, description) VALUES (?, ?, ?, ?, ?)',
        [d.companyName, d.industry ?? null, d.location ?? null, d.website ?? null, d.description ?? null]
      );
      const [u] = await conn.query<ResultSetHeader>(
        "INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'company', ?)",
        [d.name, d.email, passwordHash, c.insertId]
      );
      userId = u.insertId;
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    res.status(201).json({ token: signToken(userId), user: publicUser(user) });
  })
);

// Login semua role (candidate, company, admin, super_admin)
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await verifyPassword(password, user.password_hash)))
      throw new HttpError(401, 'Email atau password salah');
    if (!user.is_active) throw new HttpError(403, 'Akun dinonaktifkan');
    res.json({ token: signToken(user.id), user: publicUser(user) });
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
