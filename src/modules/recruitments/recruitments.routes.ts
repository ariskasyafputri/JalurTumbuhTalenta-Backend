import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany, optionalAuth } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();

const baseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10),
  requirements: z.string().trim().nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']).default('full_time'),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['draft', 'open', 'closed']).default('draft'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').nullable().optional(),
  companyId: z.number().int().positive().optional(), // hanya dipakai super_admin
});

const createSchema = baseSchema.refine(
  (d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax,
  { message: 'salaryMin tidak boleh lebih besar dari salaryMax', path: ['salaryMin'] }
);
const updateSchema = baseSchema.partial().refine(
  (d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax,
  { message: 'salaryMin tidak boleh lebih besar dari salaryMax', path: ['salaryMin'] }
);

const columnMap: Record<string, string> = {
  title: 'title',
  description: 'description',
  requirements: 'requirements',
  location: 'location',
  employmentType: 'employment_type',
  salaryMin: 'salary_min',
  salaryMax: 'salary_max',
  status: 'status',
  deadline: 'deadline',
};

const SELECT = `
  SELECT r.id, r.company_id, c.name AS company_name, c.location AS company_location,
         r.title, r.description, r.requirements, r.location, r.employment_type,
         r.salary_min, r.salary_max, r.status, r.deadline, r.created_at, r.updated_at
  FROM recruitments r JOIN companies c ON c.id = r.company_id`;

// ---------- PUBLIK: daftar lowongan terbuka ----------
// GET /api/recruitments?q=&location=&type=&companyId=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where = ["r.status = 'open'", '(r.deadline IS NULL OR r.deadline >= CURDATE())'];
    const params: any[] = [];
    if (req.query.q) {
      where.push('(r.title LIKE ? OR c.name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.location) {
      where.push('r.location LIKE ?');
      params.push(`%${req.query.location}%`);
    }
    if (req.query.type) {
      where.push('r.employment_type = ?');
      params.push(req.query.type);
    }
    if (req.query.companyId) {
      where.push('r.company_id = ?');
      params.push(parseId(req.query.companyId));
    }
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM recruitments r JOIN companies c ON c.id = r.company_id ${w}`,
      params
    );
    const data = await query(`${SELECT} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ---------- STAFF: daftar rekrutmen milik perusahaan (semua status) ----------
// super_admin: semua perusahaan (bisa filter ?companyId=&status=)
router.get(
  '/manage/list',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const u = req.user!;
    const where: string[] = [];
    const params: any[] = [];
    if (u.role === 'super_admin') {
      if (req.query.companyId) {
        where.push('r.company_id = ?');
        params.push(parseId(req.query.companyId));
      }
    } else {
      where.push('r.company_id = ?');
      params.push(u.companyId);
    }
    if (req.query.status) {
      where.push('r.status = ?');
      params.push(req.query.status);
    }
    if (req.query.q) {
      where.push('r.title LIKE ?');
      params.push(`%${req.query.q}%`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM recruitments r ${w}`,
      params
    );
    const data = await query(
      `${SELECT} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ---------- Detail ----------
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const rec = await queryOne<any>(`${SELECT} WHERE r.id = ?`, [id]);
    if (!rec) throw new HttpError(404, 'Rekrutmen tidak ditemukan');
    const u = req.user;
    const isOwner = u && canManageCompany(u, rec.company_id);
    if (rec.status !== 'open' && !isOwner) throw new HttpError(404, 'Rekrutmen tidak ditemukan');
    res.json({ data: rec });
  })
);

// ---------- Buat rekrutmen (admin / company / super_admin) ----------
router.post(
  '/',
  authenticate,
  authorize('admin', 'company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const d = createSchema.parse(req.body);
    const u = req.user!;
    const companyId = u.role === 'super_admin' ? d.companyId : u.companyId;
    if (!companyId) throw new HttpError(400, u.role === 'super_admin' ? 'companyId wajib diisi' : 'Akun belum terhubung ke perusahaan');
    if (!(await queryOne('SELECT id FROM companies WHERE id = ?', [companyId])))
      throw new HttpError(404, 'Perusahaan tidak ditemukan');

    const r = await execute(
      `INSERT INTO recruitments
       (company_id, created_by, title, description, requirements, location, employment_type, salary_min, salary_max, status, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, u.id, d.title, d.description, d.requirements ?? null, d.location ?? null,
        d.employmentType, d.salaryMin ?? null, d.salaryMax ?? null, d.status, d.deadline ?? null,
      ]
    );
    res.status(201).json({ data: await queryOne(`${SELECT} WHERE r.id = ?`, [r.insertId]) });
  })
);

// ---------- Ubah / hapus ----------
async function getManageable(req: any) {
  const id = parseId(req.params.id);
  const rec = await queryOne<any>('SELECT id, company_id FROM recruitments WHERE id = ?', [id]);
  if (!rec) throw new HttpError(404, 'Rekrutmen tidak ditemukan');
  if (!canManageCompany(req.user, rec.company_id)) throw new HttpError(403, 'Kamu tidak punya akses');
  return id;
}

router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = await getManageable(req);
    const d = updateSchema.parse(req.body) as Record<string, any>;
    const entries = Object.entries(d).filter(([k, v]) => v !== undefined && columnMap[k]);
    if (!entries.length) throw new HttpError(400, 'Tidak ada data yang diubah');
    await execute(
      `UPDATE recruitments SET ${entries.map(([k]) => `${columnMap[k]} = ?`).join(', ')} WHERE id = ?`,
      [...entries.map(([, v]) => v), id]
    );
    res.json({ data: await queryOne(`${SELECT} WHERE r.id = ?`, [id]) });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = await getManageable(req);
    await execute('DELETE FROM recruitments WHERE id = ?', [id]);
    res.json({ message: 'Rekrutmen dihapus' });
  })
);

// ---------- Lihat pelamar rekrutmen ----------
router.get(
  '/:id/applications',
  authenticate,
  authorize('admin', 'company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = await getManageable(req);
    const { page, limit, offset } = pagination(req.query);
    const params: any[] = [id];
    let statusSql = '';
    if (req.query.status) {
      statusSql = 'AND a.status = ?';
      params.push(req.query.status);
    }
    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM applications a WHERE a.recruitment_id = ? ${statusSql}`,
      params
    );
    const data = await query(
      `SELECT a.id, a.status, a.cover_letter, a.resume_url, a.created_at,
              u.id AS candidate_id, u.name AS candidate_name, u.email AS candidate_email
       FROM applications a JOIN users u ON u.id = a.candidate_id
       WHERE a.recruitment_id = ? ${statusSql}
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

export default router;
