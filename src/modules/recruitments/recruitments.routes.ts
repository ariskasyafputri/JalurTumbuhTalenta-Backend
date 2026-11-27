import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany, optionalAuth } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();

function generateJobSlug(title: string) {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const randomCode = crypto.randomBytes(4).toString('hex');
  return `${cleanTitle || 'lowongan'}-${randomCode}`;
}

const baseSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive('Bidang posisi wajib dipilih'),
  employmentTypeId: z.coerce.number().int().positive('Tipe pekerjaan wajib dipilih'),
  provinceId: z.coerce.number().int().positive('Provinsi wajib dipilih'),
  title: z.string().trim().min(3, 'Judul posisi minimal 3 karakter').max(180),
  detailAddress: z.string().trim().min(3, 'Alamat detail wajib diisi').max(1000),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  hideSalary: z.boolean().optional().default(false),
  minExperience: z.string().trim().max(80).nullable().optional(),
  benefitIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  description: z.string().trim().min(10, 'Deskripsi pekerjaan minimal 10 karakter'),
  requirements: z.string().trim().min(5, 'Kualifikasi wajib diisi'),
  openedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal dibuka harus YYYY-MM-DD'),
  closedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal ditutup harus YYYY-MM-DD'),
  status: z.enum(['draft', 'open', 'closed']).default('open'),
});

const createSchema = baseSchema
  .refine((d) => d.hideSalary || d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax, {
    message: 'Gaji minimal tidak boleh lebih besar dari gaji maksimal',
    path: ['salaryMin'],
  })
  .refine((d) => d.openedAt <= d.closedAt, {
    message: 'Tanggal dibuka tidak boleh melewati tanggal ditutup',
    path: ['closedAt'],
  });

const updateSchema = baseSchema.partial();

const columnMap: Record<string, string> = {
  companyId: 'company_id',
  categoryId: 'category_id',
  employmentTypeId: 'employment_type_id',
  provinceId: 'province_id',
  title: 'title',
  detailAddress: 'detail_address',
  salaryMin: 'salary_min',
  salaryMax: 'salary_max',
  hideSalary: 'hide_salary',
  minExperience: 'min_experience',
  description: 'description',
  requirements: 'requirements',
  openedAt: 'opened_at',
  closedAt: 'closed_at',
  status: 'status',
};

const SELECT = `
  SELECT r.id, r.slug, r.company_id, c.name AS company_name, c.logo_path AS company_logo_path,
         c.industry AS company_industry, c.company_size, c.is_verified AS company_verified, c.subscription_plan,
         r.category_id, jc.name AS category_name,
         r.employment_type_id, et.name AS employment_type_name,
         r.province_id, p.name AS province_name,
         r.title, r.detail_address, r.salary_min, r.salary_max, r.hide_salary, r.min_experience,
         r.description, r.requirements, r.opened_at, r.closed_at,
         r.status, r.created_at, r.updated_at,
         (SELECT COUNT(*) FROM applications a WHERE a.recruitment_id = r.id) AS applicants_count
  FROM recruitments r
  JOIN companies c ON c.id = r.company_id
  JOIN job_categories jc ON jc.id = r.category_id
  JOIN employment_types et ON et.id = r.employment_type_id
  JOIN provinces p ON p.id = r.province_id
`;

async function attachBenefits(rows: any[]) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const benefitRows = await query<{ recruitment_id: number; id: number; name: string }>(
    `SELECT rb.recruitment_id, b.id, b.name
     FROM recruitment_benefits rb
     JOIN benefits b ON b.id = rb.benefit_id
     WHERE rb.recruitment_id IN (${ids.map(() => '?').join(',')})
     ORDER BY b.id ASC`,
    ids
  );

  const map = new Map<number, { id: number; name: string }[]>();
  for (const br of benefitRows) {
    const arr = map.get(br.recruitment_id) ?? [];
    arr.push({ id: br.id, name: br.name });
    map.set(br.recruitment_id, arr);
  }

  for (const row of rows) {
    row.benefits = map.get(row.id) ?? [];
  }
  return rows;
}

async function syncRecruitmentBenefits(recruitmentId: number, benefitIds: number[]) {
  await execute('DELETE FROM recruitment_benefits WHERE recruitment_id = ?', [recruitmentId]);
  const uniqueIds = Array.from(new Set(benefitIds));
  if (!uniqueIds.length) return;
  const valuesSql = uniqueIds.map(() => '(?, ?)').join(', ');
  const params: number[] = [];
  for (const bid of uniqueIds) {
    params.push(recruitmentId, bid);
  }
  await execute(`INSERT INTO recruitment_benefits (recruitment_id, benefit_id) VALUES ${valuesSql}`, params);
}

// PUBLIK: Daftar lowongan terbuka
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where = ["r.status = 'open'", 'r.closed_at >= CURDATE()'];
    const params: any[] = [];

    if (req.query.q) {
      where.push('(r.title LIKE ? OR c.name LIKE ? OR jc.name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.categoryId) {
      where.push('r.category_id = ?');
      params.push(parseId(req.query.categoryId));
    }
    if (req.query.employmentTypeId) {
      where.push('r.employment_type_id = ?');
      params.push(parseId(req.query.employmentTypeId));
    }
    if (req.query.provinceId) {
      where.push('r.province_id = ?');
      params.push(parseId(req.query.provinceId));
    }
    if (req.query.companyId) {
      where.push('r.company_id = ?');
      params.push(parseId(req.query.companyId));
    }

    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM recruitments r
       JOIN companies c ON c.id = r.company_id
       JOIN job_categories jc ON jc.id = r.category_id
       ${w}`,
      params
    );

    const data = await query<any>(`${SELECT} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    await attachBenefits(data);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// STAFF: Kelola lowongan
router.get(
  '/manage/list',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const u = req.user!;
    const where: string[] = [];
    const params: any[] = [];

    if (u.role === 'company') {
      const ids = u.companies.map((c) => c.companyId);
      if (!ids.length) {
        return res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
      }
      if (req.query.companyId) {
        const cid = parseId(req.query.companyId);
        if (!ids.includes(cid)) throw new HttpError(403, 'Tidak punya akses ke perusahaan ini');
        where.push('r.company_id = ?');
        params.push(cid);
      } else {
        where.push(`r.company_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
    } else if (req.query.companyId) {
      where.push('r.company_id = ?');
      params.push(parseId(req.query.companyId));
    }

    if (req.query.status) {
      where.push('r.status = ?');
      params.push(req.query.status);
    }
    if (req.query.q) {
      where.push('(r.title LIKE ? OR c.name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }

    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM recruitments r JOIN companies c ON c.id = r.company_id ${w}`,
      params
    );
    const data = await query<any>(`${SELECT} ${w} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    await attachBenefits(data);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// DETAIL LOWONGAN (Mendukung slug maupun numeric ID untuk halaman edit dashboard)
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const param = String(req.params.slug || '').trim();
    if (!param) throw new HttpError(400, 'Identifier lowongan tidak valid');

    const isNumericId = /^\d+$/.test(param);
    const rec = await queryOne<any>(
      `${SELECT} WHERE ${isNumericId ? 'r.id = ?' : 'r.slug = ?'}`,
      [isNumericId ? Number(param) : param]
    );
    if (!rec) throw new HttpError(404, 'Lowongan tidak ditemukan');

    const u = req.user;
    const isOwner = u && canManageCompany(u, rec.company_id);
    if (rec.status !== 'open' && !isOwner) throw new HttpError(404, 'Lowongan tidak ditemukan');

    await attachBenefits([rec]);
    res.json({ data: rec });
  })
);

// BUAT LOWONGAN
router.post(
  '/',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const d = createSchema.parse(req.body);
    const u = req.user!;
    if (!canManageCompany(u, d.companyId)) {
      throw new HttpError(403, 'Kamu tidak punya akses ke perusahaan ini');
    }

    const company = await queryOne<any>('SELECT id, max_active_jobs, subscription_plan FROM companies WHERE id = ?', [
      d.companyId,
    ]);
    if (!company) throw new HttpError(404, 'Perusahaan tidak ditemukan');

    if (u.role === 'company' && d.status === 'open') {
      const [{ activeCount }] = await query<{ activeCount: number }>(
        "SELECT COUNT(*) AS activeCount FROM recruitments WHERE company_id = ? AND status = 'open'",
        [d.companyId]
      );
      if (activeCount >= company.max_active_jobs) {
        throw new HttpError(
          403,
          `Batas lowongan aktif untuk paket ${company.subscription_plan.toUpperCase()} (${company.max_active_jobs} lowongan) sudah tercapai. Hubungi Admin untuk upgrade paket.`
        );
      }
    }

    const slug = generateJobSlug(d.title);

    const r = await execute(
      `INSERT INTO recruitments
       (slug, company_id, category_id, employment_type_id, province_id, title, detail_address, salary_min, salary_max, hide_salary, min_experience, description, requirements, opened_at, closed_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        d.companyId,
        d.categoryId,
        d.employmentTypeId,
        d.provinceId,
        d.title,
        d.detailAddress,
        d.hideSalary ? null : (d.salaryMin ?? null),
        d.hideSalary ? null : (d.salaryMax ?? null),
        d.hideSalary ? 1 : 0,
        d.minExperience ?? null,
        d.description,
        d.requirements,
        d.openedAt,
        d.closedAt,
        d.status,
        u.id,
      ]
    );

    if (d.benefitIds?.length) {
      await syncRecruitmentBenefits(r.insertId, d.benefitIds);
    }

    const created = await queryOne<any>(`${SELECT} WHERE r.id = ?`, [r.insertId]);
    await attachBenefits([created]);
    res.status(201).json({ data: created });
  })
);

async function getManageable(req: any) {
  const id = parseId(req.params.id);
  const rec = await queryOne<any>('SELECT id, company_id FROM recruitments WHERE id = ?', [id]);
  if (!rec) throw new HttpError(404, 'Lowongan tidak ditemukan');
  if (!canManageCompany(req.user, rec.company_id)) throw new HttpError(403, 'Kamu tidak punya akses');
  return id;
}

router.patch(
  '/:id',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = await getManageable(req);
    const d = updateSchema.parse(req.body) as Record<string, any>;

    if (d.hideSalary === true) {
      d.salaryMin = null;
      d.salaryMax = null;
    }

    const entries = Object.entries(d).filter(([k, v]) => v !== undefined && columnMap[k]);
    if (entries.length) {
      await execute(
        `UPDATE recruitments SET ${entries.map(([k]) => `${columnMap[k]} = ?`).join(', ')} WHERE id = ?`,
        [...entries.map(([k, v]) => (k === 'hideSalary' ? (v ? 1 : 0) : v)), id]
      );
    }

    if (Array.isArray(d.benefitIds)) {
      await syncRecruitmentBenefits(id, d.benefitIds);
    }

    const updated = await queryOne<any>(`${SELECT} WHERE r.id = ?`, [id]);
    await attachBenefits([updated]);
    res.json({ data: updated });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = await getManageable(req);
    await execute('DELETE FROM recruitments WHERE id = ?', [id]);
    res.json({ message: 'Lowongan dihapus' });
  })
);

// LIHAT PELAMAR LOWONGAN BESERTA PROFIL, NO TELEPON & PENGALAMAN KERJANYA
router.get(
  '/:id/applications',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
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

    const rows = await query<any>(
      `SELECT a.id, a.status, a.cover_letter, a.cv_snapshot_path, a.notes, a.applied_at,
              u.id AS candidate_id, u.name AS candidate_name, u.email AS candidate_email,
              cp.phone, cp.photo_path, cp.headline, cp.education_level, cp.institution, cp.major,
              cp.graduation_year, cp.skills, cp.certifications, cp.portfolio_url, cp.cv_path,
              p.name AS province_name
       FROM applications a
       JOIN users u ON u.id = a.candidate_id
       LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
       LEFT JOIN provinces p ON p.id = cp.province_id
       WHERE a.recruitment_id = ? ${statusSql}
       ORDER BY a.applied_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    for (const row of rows) {
      row.experiences = await query(
        'SELECT * FROM candidate_experiences WHERE user_id = ? ORDER BY start_date DESC',
        [row.candidate_id]
      );
    }

    res.json({ data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

export default router;