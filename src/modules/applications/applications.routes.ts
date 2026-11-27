import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();

const applySchema = z.object({
  coverLetter: z.string().trim().max(5000).optional(),
});

// Kandidat melamar: POST /api/applications/apply/:slug
router.post(
  '/apply/:slug',
  authenticate,
  authorize('candidate'),
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').trim();
    if (!slug) throw new HttpError(400, 'Slug lowongan tidak valid');

    const d = applySchema.parse(req.body);
    const rec = await queryOne<any>(
      "SELECT id, slug, status, closed_at FROM recruitments WHERE slug = ? AND status = 'open'",
      [slug]
    );
    if (!rec) throw new HttpError(404, 'Lowongan tidak ditemukan atau sudah ditutup');
    if (rec.closed_at && new Date(String(rec.closed_at).slice(0, 10) + 'T23:59:59') < new Date()) {
      throw new HttpError(400, 'Lowongan sudah melewati tanggal penutupan');
    }
    if (
      await queryOne('SELECT id FROM applications WHERE recruitment_id = ? AND candidate_id = ?', [
        rec.id,
        req.user!.id,
      ])
    ) {
      throw new HttpError(409, 'Kamu sudah melamar lowongan ini');
    }

    const profile = await queryOne<any>('SELECT cv_path FROM candidate_profiles WHERE user_id = ?', [req.user!.id]);
    const r = await execute(
      'INSERT INTO applications (recruitment_id, candidate_id, cover_letter, cv_snapshot_path) VALUES (?, ?, ?, ?)',
      [rec.id, req.user!.id, d.coverLetter ?? null, profile?.cv_path ?? null]
    );
    res.status(201).json({
      data: {
        id: r.insertId,
        recruitmentId: rec.id,
        recruitmentSlug: rec.slug,
        status: 'submitted',
      },
    });
  })
);

// Riwayat lamaran kandidat
router.get(
  '/me',
  authenticate,
  authorize('candidate'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const [{ total }] = await query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM applications WHERE candidate_id = ?',
      [req.user!.id]
    );
    const data = await query(
      `SELECT a.id, a.status, a.cover_letter, a.notes, a.applied_at,
              r.id AS recruitment_id, r.slug AS recruitment_slug, r.title,
              c.name AS company_name, c.logo_path AS company_logo_path,
              p.name AS province_name, et.name AS employment_type_name
       FROM applications a
       JOIN recruitments r ON r.id = a.recruitment_id
       JOIN companies c ON c.id = r.company_id
       JOIN provinces p ON p.id = r.province_id
       JOIN employment_types et ON et.id = r.employment_type_id
       WHERE a.candidate_id = ? ORDER BY a.applied_at DESC LIMIT ? OFFSET ?`,
      [req.user!.id, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// Kandidat membatalkan lamaran
router.delete(
  '/:id',
  authenticate,
  authorize('candidate'),
  asyncHandler(async (req, res) => {
    const r = await execute('DELETE FROM applications WHERE id = ? AND candidate_id = ?', [
      parseId(req.params.id),
      req.user!.id,
    ]);
    if (!r.affectedRows) throw new HttpError(404, 'Lamaran tidak ditemukan');
    res.json({ message: 'Lamaran dibatalkan' });
  })
);

// Perusahaan / Admin / SuperAdmin mengubah status lamaran
router.patch(
  '/:id/status',
  authenticate,
  authorize('company', 'admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { status, notes } = z
      .object({
        status: z.enum(['submitted', 'reviewed', 'interview', 'accepted', 'rejected']),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);

    const app = await queryOne<any>(
      'SELECT a.id, r.company_id FROM applications a JOIN recruitments r ON r.id = a.recruitment_id WHERE a.id = ?',
      [id]
    );
    if (!app) throw new HttpError(404, 'Lamaran tidak ditemukan');
    if (!canManageCompany(req.user!, app.company_id)) throw new HttpError(403, 'Kamu tidak punya akses');

    await execute('UPDATE applications SET status = ?, notes = COALESCE(?, notes) WHERE id = ?', [
      status,
      notes ?? null,
      id,
    ]);
    res.json({ data: { id, status } });
  })
);

export default router;