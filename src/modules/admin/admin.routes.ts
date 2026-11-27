import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();
router.use(authenticate, authorize('admin', 'super_admin'));

// MENU 1: DATA PERUSAHAAN + PENGATURAN PAKET & BATASAN FITUR
router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.q) {
      where.push('(c.name LIKE ? OR c.npwp LIKE ? OR c.nib LIKE ? OR c.industry LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM companies c ${w}`, params);
    const data = await query(
      `SELECT c.*, p.name AS province_name,
              (SELECT COUNT(*) FROM recruitments r WHERE r.company_id = c.id) AS total_recruitments,
              (SELECT COUNT(*) FROM recruitments r WHERE r.company_id = c.id AND r.status = 'open') AS active_recruitments,
              (SELECT GROUP_CONCAT(u.email SEPARATOR ', ')
               FROM company_members cm JOIN users u ON u.id = cm.user_id
               WHERE cm.company_id = c.id) AS pic_emails
       FROM companies c
       LEFT JOIN provinces p ON p.id = c.province_id
       ${w}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

const companyFeatureSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  npwp: z.string().trim().max(30).nullable().optional(),
  nib: z.string().trim().max(30).nullable().optional(),
  provinceId: z.coerce.number().int().positive().nullable().optional(),
  detailAddress: z.string().trim().max(1000).nullable().optional(),
  subscriptionPlan: z.enum(['free', 'pro', 'enterprise']).optional(),
  maxActiveJobs: z.coerce.number().int().min(0).max(9999).optional(),
  canViewCv: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

router.patch(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const d = companyFeatureSchema.parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];

    if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name); }
    if (d.industry !== undefined) { sets.push('industry = ?'); params.push(d.industry); }
    if (d.npwp !== undefined) { sets.push('npwp = ?'); params.push(d.npwp); }
    if (d.nib !== undefined) { sets.push('nib = ?'); params.push(d.nib); }
    if (d.provinceId !== undefined) { sets.push('province_id = ?'); params.push(d.provinceId); }
    if (d.detailAddress !== undefined) { sets.push('detail_address = ?'); params.push(d.detailAddress); }
    if (d.subscriptionPlan !== undefined) { sets.push('subscription_plan = ?'); params.push(d.subscriptionPlan); }
    if (d.maxActiveJobs !== undefined) { sets.push('max_active_jobs = ?'); params.push(d.maxActiveJobs); }
    if (d.canViewCv !== undefined) { sets.push('can_view_cv = ?'); params.push(d.canViewCv ? 1 : 0); }
    if (d.isVerified !== undefined) { sets.push('is_verified = ?'); params.push(d.isVerified ? 1 : 0); }

    if (!sets.length) throw new HttpError(400, 'Tidak ada data yang diubah');
    const r = await execute(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ data: await queryOne('SELECT * FROM companies WHERE id = ?', [id]) });
  })
);

router.delete(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const r = await execute('DELETE FROM companies WHERE id = ?', [parseId(req.params.id)]);
    if (!r.affectedRows) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ message: 'Perusahaan dihapus' });
  })
);

// MENU 2: DATA USER KANDIDAT & PERUSAHAAN YANG DILAMAR
router.get(
  '/candidates',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where = ["u.role = 'candidate'"];
    const params: any[] = [];

    if (req.query.q) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR cp.headline LIKE ? OR cp.skills LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    const w = `WHERE ${where.join(' AND ')}`;

    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM users u LEFT JOIN candidate_profiles cp ON cp.user_id = u.id ${w}`,
      params
    );

    const candidates = await query<any>(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
              cp.phone, cp.headline, cp.education_level, cp.institution, cp.major,
              cp.skills, cp.portfolio_url, cp.cv_path, p.name AS province_name
       FROM users u
       LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
       LEFT JOIN provinces p ON p.id = cp.province_id
       ${w}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    for (const c of candidates) {
      c.applications = await query(
        `SELECT a.id, a.status, a.applied_at, r.title AS job_title, comp.id AS company_id, comp.name AS company_name
         FROM applications a
         JOIN recruitments r ON r.id = a.recruitment_id
         JOIN companies comp ON comp.id = r.company_id
         WHERE a.candidate_id = ?
         ORDER BY a.applied_at DESC`,
        [c.id]
      );
      c.experiences = await query(
        'SELECT * FROM candidate_experiences WHERE user_id = ? ORDER BY start_date DESC',
        [c.id]
      );
    }

    res.json({ data: candidates, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.patch(
  '/candidates/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const d = z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name); }
    if (d.isActive !== undefined) { sets.push('is_active = ?'); params.push(d.isActive ? 1 : 0); }
    if (!sets.length) throw new HttpError(400, 'Tidak ada data yang diubah');

    const r = await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND role = 'candidate'`, [...params, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Kandidat tidak ditemukan');
    res.json({ message: 'Data kandidat diperbarui' });
  })
);

router.delete(
  '/candidates/:id',
  asyncHandler(async (req, res) => {
    const r = await execute("DELETE FROM users WHERE id = ? AND role = 'candidate'", [parseId(req.params.id)]);
    if (!r.affectedRows) throw new HttpError(404, 'Kandidat tidak ditemukan');
    res.json({ message: 'Kandidat dihapus' });
  })
);

export default router;
