import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany } from '../../middleware/auth';
import { hashPassword } from '../../utils/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();

// Tim rekrutmen (company, admin) & super admin bisa mencari perusahaan
router.use(authenticate, authorize('company', 'admin', 'super_admin'));

// GET /api/companies?q=&industry=&location=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where: string[] = [];
    const params: any[] = [];

    if (req.query.q) {
      where.push('(c.name LIKE ? OR c.description LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.industry) {
      where.push('c.industry LIKE ?');
      params.push(`%${req.query.industry}%`);
    }
    if (req.query.location) {
      where.push('c.location LIKE ?');
      params.push(`%${req.query.location}%`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM companies c ${w}`, params);
    const data = await query(
      `SELECT c.id, c.name, c.description, c.industry, c.location, c.website, c.created_at,
              (SELECT COUNT(*) FROM recruitments r WHERE r.company_id = c.id AND r.status = 'open') AS open_recruitments
       FROM companies c ${w} ORDER BY c.name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const company = await queryOne('SELECT * FROM companies WHERE id = ?', [parseId(req.params.id)]);
    if (!company) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ data: company });
  })
);

const updateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  industry: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  website: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url().max(255).nullable().optional()),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!canManageCompany(req.user!, id)) throw new HttpError(403, 'Kamu tidak punya akses');
    const data = updateSchema.parse(req.body);
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (!entries.length) throw new HttpError(400, 'Tidak ada data yang diubah');

    const r = await execute(
      `UPDATE companies SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...entries.map(([, v]) => v), id]
    );
    if (!r.affectedRows) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ data: await queryOne('SELECT * FROM companies WHERE id = ?', [id]) });
  })
);

// ---- Kelola admin (tim rekrutmen) milik perusahaan ----
const adminSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(100),
});

router.get(
  '/:id/admins',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!canManageCompany(req.user!, id)) throw new HttpError(403, 'Kamu tidak punya akses');
    const data = await query(
      "SELECT id, name, email, is_active, created_at FROM users WHERE company_id = ? AND role = 'admin'",
      [id]
    );
    res.json({ data });
  })
);

// Pemilik perusahaan (role company) menambah admin rekrutmen
router.post(
  '/:id/admins',
  authorize('company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!canManageCompany(req.user!, id)) throw new HttpError(403, 'Kamu tidak punya akses');
    const d = adminSchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email]))
      throw new HttpError(409, 'Email sudah terdaftar');
    const r = await execute(
      "INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)",
      [d.name, d.email, await hashPassword(d.password), id]
    );
    res.status(201).json({ data: { id: r.insertId, name: d.name, email: d.email, role: 'admin', companyId: id } });
  })
);

export default router;
