import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { hashPassword } from '../../utils/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();
router.use(authenticate, authorize('super_admin'));

const roles = ['candidate', 'company', 'admin', 'super_admin'] as const;

// Dashboard ringkas
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [row] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role='candidate') AS candidates,
        (SELECT COUNT(*) FROM users WHERE role='company') AS company_accounts,
        (SELECT COUNT(*) FROM users WHERE role='admin') AS admins,
        (SELECT COUNT(*) FROM companies) AS companies,
        (SELECT COUNT(*) FROM recruitments) AS recruitments,
        (SELECT COUNT(*) FROM recruitments WHERE status='open') AS open_recruitments,
        (SELECT COUNT(*) FROM applications) AS applications`
    );
    res.json({ data: row });
  })
);

// ---- USERS ----
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.role) {
      where.push('u.role = ?');
      params.push(req.query.role);
    }
    if (req.query.q) {
      where.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.isActive !== undefined) {
      where.push('u.is_active = ?');
      params.push(req.query.isActive === 'true' ? 1 : 0);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM users u ${w}`, params);
    const data = await query(
      `SELECT u.id, u.name, u.email, u.role, u.company_id, c.name AS company_name, u.is_active, u.created_at
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       ${w} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const u = await queryOne(
      'SELECT id, name, email, role, company_id, is_active, created_at FROM users WHERE id = ?',
      [parseId(req.params.id)]
    );
    if (!u) throw new HttpError(404, 'User tidak ditemukan');
    res.json({ data: u });
  })
);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.enum(roles),
  companyId: z.number().int().positive().nullable().optional(),
});

// Super admin membuat user apa pun (satu-satunya jalur membuat admin/super_admin lewat API)
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const d = createUserSchema.parse(req.body);
    if ((d.role === 'company' || d.role === 'admin') && !d.companyId)
      throw new HttpError(400, 'companyId wajib untuk role company/admin');
    if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email]))
      throw new HttpError(409, 'Email sudah terdaftar');
    const r = await execute(
      'INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, ?, ?)',
      [d.name, d.email, await hashPassword(d.password), d.role, d.companyId ?? null]
    );
    res.status(201).json({ data: { id: r.insertId, name: d.name, email: d.email, role: d.role, companyId: d.companyId ?? null } });
  })
);

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(roles).optional(),
  companyId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const d = updateUserSchema.parse(req.body);
    if (id === req.user!.id && (d.isActive === false || (d.role && d.role !== 'super_admin')))
      throw new HttpError(400, 'Tidak bisa menonaktifkan / menurunkan role akun sendiri');

    const sets: string[] = [];
    const params: any[] = [];
    if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name); }
    if (d.email !== undefined) { sets.push('email = ?'); params.push(d.email); }
    if (d.password !== undefined) { sets.push('password_hash = ?'); params.push(await hashPassword(d.password)); }
    if (d.role !== undefined) { sets.push('role = ?'); params.push(d.role); }
    if (d.companyId !== undefined) { sets.push('company_id = ?'); params.push(d.companyId); }
    if (d.isActive !== undefined) { sets.push('is_active = ?'); params.push(d.isActive ? 1 : 0); }
    if (!sets.length) throw new HttpError(400, 'Tidak ada data yang diubah');

    const r = await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (!r.affectedRows) throw new HttpError(404, 'User tidak ditemukan');
    res.json({
      data: await queryOne('SELECT id, name, email, role, company_id, is_active FROM users WHERE id = ?', [id]),
    });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === req.user!.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri');
    const r = await execute('DELETE FROM users WHERE id = ?', [id]);
    if (!r.affectedRows) throw new HttpError(404, 'User tidak ditemukan');
    res.json({ message: 'User dihapus' });
  })
);

// ---- COMPANIES ----
router.delete(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const r = await execute('DELETE FROM companies WHERE id = ?', [parseId(req.params.id)]);
    if (!r.affectedRows) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ message: 'Perusahaan dihapus (beserta rekrutmennya)' });
  })
);

// ---- RECRUITMENTS & APPLICATIONS: kelola lewat endpoint /api/recruitments (super_admin lolos semua cek) ----
router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const [{ total }] = await query<{ total: number }>('SELECT COUNT(*) AS total FROM applications');
    const data = await query(
      `SELECT a.id, a.status, a.created_at, u.name AS candidate_name, u.email AS candidate_email,
              r.id AS recruitment_id, r.title, c.name AS company_name
       FROM applications a
       JOIN users u ON u.id = a.candidate_id
       JOIN recruitments r ON r.id = a.recruitment_id
       JOIN companies c ON c.id = r.company_id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

export default router;
