import { Router } from 'express';
import { ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { execute, pool, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';
import { uploadLogo, deleteFileIfExists } from '../../utils/upload';

const router = Router();
router.use(authenticate, authorize('company', 'admin', 'super_admin'));

const SELECT_COMPANY = `
  SELECT c.*, p.name AS province_name,
         (SELECT COUNT(*) FROM recruitments r WHERE r.company_id = c.id AND r.status = 'open') AS open_recruitments
  FROM companies c
  LEFT JOIN provinces p ON p.id = c.province_id
`;

router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const u = req.user!;
    if (u.role === 'super_admin' || u.role === 'admin') {
      const data = await query(`${SELECT_COMPANY} ORDER BY c.name ASC`);
      return res.json({ data });
    }
    const data = await query(
      `${SELECT_COMPANY}
       JOIN company_members cm ON cm.company_id = c.id
       WHERE cm.user_id = ?
       ORDER BY cm.id ASC`,
      [u.id]
    );
    res.json({ data });
  })
);

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(160),
  industry: z.string().trim().max(120).optional(),
  companySize: z.string().trim().max(60).optional(),
  npwp: z.string().trim().max(30).optional(),
  nib: z.string().trim().max(30).optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  detailAddress: z.string().trim().max(1000).optional(),
  website: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().url().max(255).optional()),
  phone: z.string().trim().max(30).optional(),
  description: z.string().trim().max(5000).optional(),
});

router.post(
  '/',
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const d = createCompanySchema.parse(req.body);
    const conn = await pool.getConnection();
    let companyId: number;
    try {
      await conn.beginTransaction();
      const [c] = await conn.query<ResultSetHeader>(
        `INSERT INTO companies (name, industry, company_size, npwp, nib, province_id, detail_address, website, phone, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.name,
          d.industry ?? null,
          d.companySize ?? null,
          d.npwp ?? null,
          d.nib ?? null,
          d.provinceId ?? null,
          d.detailAddress ?? null,
          d.website ?? null,
          d.phone ?? null,
          d.description ?? null,
        ]
      );
      companyId = c.insertId;
      if (req.user!.role === 'company') {
        await conn.query(
          "INSERT INTO company_members (user_id, company_id, member_role) VALUES (?, ?, 'owner')",
          [req.user!.id, companyId]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    const created = await queryOne(`${SELECT_COMPANY} WHERE c.id = ?`, [companyId]);
    res.status(201).json({ data: created });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where: string[] = [];
    const params: any[] = [];

    if (req.query.q) {
      where.push('(c.name LIKE ? OR c.industry LIKE ? OR c.npwp LIKE ? OR c.nib LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.provinceId) {
      where.push('c.province_id = ?');
      params.push(parseId(req.query.provinceId));
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM companies c ${w}`, params);
    const data = await query(`${SELECT_COMPANY} ${w} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const company = await queryOne(`${SELECT_COMPANY} WHERE c.id = ?`, [parseId(req.params.id)]);
    if (!company) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ data: company });
  })
);

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  companySize: z.string().trim().max(60).nullable().optional(),
  npwp: z.string().trim().max(30).nullable().optional(),
  nib: z.string().trim().max(30).nullable().optional(),
  provinceId: z.coerce.number().int().positive().nullable().optional(),
  detailAddress: z.string().trim().max(1000).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  website: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url().max(255).nullable().optional()),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!canManageCompany(req.user!, id)) throw new HttpError(403, 'Kamu tidak punya akses ke perusahaan ini');
    const d = updateSchema.parse(req.body);

    const colMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      industry: 'industry',
      companySize: 'company_size',
      npwp: 'npwp',
      nib: 'nib',
      provinceId: 'province_id',
      detailAddress: 'detail_address',
      phone: 'phone',
      website: 'website',
    };

    const entries = Object.entries(d).filter(([k, v]) => v !== undefined && colMap[k]);
    if (!entries.length) throw new HttpError(400, 'Tidak ada data yang diubah');

    const r = await execute(
      `UPDATE companies SET ${entries.map(([k]) => `${colMap[k]} = ?`).join(', ')} WHERE id = ?`,
      [...entries.map(([, v]) => v), id]
    );
    if (!r.affectedRows) throw new HttpError(404, 'Perusahaan tidak ditemukan');
    res.json({ data: await queryOne(`${SELECT_COMPANY} WHERE c.id = ?`, [id]) });
  })
);

router.post(
  '/:id/logo',
  uploadLogo.single('logo'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!canManageCompany(req.user!, id)) {
      if (req.file) deleteFileIfExists(`/uploads/logos/${req.file.filename}`);
      throw new HttpError(403, 'Kamu tidak punya akses ke perusahaan ini');
    }

    if (!req.file) throw new HttpError(400, 'File logo wajib diunggah');
    const logoPath = `/uploads/logos/${req.file.filename}`;

    const existing = await queryOne<{ id: number; logo_path: string | null }>(
      'SELECT id, logo_path FROM companies WHERE id = ?',
      [id]
    );

    if (!existing) {
      deleteFileIfExists(logoPath);
      throw new HttpError(404, 'Perusahaan tidak ditemukan');
    }

    deleteFileIfExists(existing.logo_path);
    await execute('UPDATE companies SET logo_path = ? WHERE id = ?', [logoPath, id]);

    const updated = await queryOne(`${SELECT_COMPANY} WHERE c.id = ?`, [id]);
    res.json({ data: updated, logoPath });
  })
);

export default router;