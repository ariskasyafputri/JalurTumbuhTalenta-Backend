import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize, canManageCompany } from '../../middleware/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();

const applySchema = z.object({
  coverLetter: z.string().trim().max(5000).optional(),
  resumeUrl: z.string().trim().url().max(500).optional(),
});

// Kandidat melamar: POST /api/applications/apply/:recruitmentId
router.post(
  '/apply/:recruitmentId',
  authenticate,
  authorize('candidate'),
  asyncHandler(async (req, res) => {
    const recruitmentId = parseId(req.params.recruitmentId);
    const d = applySchema.parse(req.body);
    const rec = await queryOne<any>(
      "SELECT id, status, deadline FROM recruitments WHERE id = ? AND status = 'open'",
      [recruitmentId]
    );
    if (!rec) throw new HttpError(404, 'Lowongan tidak ditemukan atau sudah ditutup');
    if (rec.deadline && new Date(String(rec.deadline).slice(0, 10) + 'T23:59:59') < new Date())
      throw new HttpError(400, 'Lowongan sudah melewati batas waktu');
    if (await queryOne('SELECT id FROM applications WHERE recruitment_id = ? AND candidate_id = ?', [recruitmentId, req.user!.id]))
      throw new HttpError(409, 'Kamu sudah melamar lowongan ini');

    const r = await execute(
      'INSERT INTO applications (recruitment_id, candidate_id, cover_letter, resume_url) VALUES (?, ?, ?, ?)',
      [recruitmentId, req.user!.id, d.coverLetter ?? null, d.resumeUrl ?? null]
    );
    res.status(201).json({ data: { id: r.insertId, recruitmentId, status: 'applied' } });
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
      `SELECT a.id, a.status, a.created_at, r.id AS recruitment_id, r.title, c.name AS company_name
       FROM applications a
       JOIN recruitments r ON r.id = a.recruitment_id
       JOIN companies c ON c.id = r.company_id
       WHERE a.candidate_id = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [req.user!.id, limit, offset]
    );
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// Kandidat menarik lamaran
router.delete(
  '/:id',
  authenticate,
  authorize('candidate'),
  asyncHandler(async (req, res) => {
    const r = await execute('DELETE FROM applications WHERE id = ? AND candidate_id = ?', [parseId(req.params.id), req.user!.id]);
    if (!r.affectedRows) throw new HttpError(404, 'Lamaran tidak ditemukan');
    res.json({ message: 'Lamaran ditarik' });
  })
);

// Staff mengubah status lamaran
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin', 'company', 'super_admin'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = z
      .object({ status: z.enum(['applied', 'reviewed', 'interview', 'offered', 'accepted', 'rejected']) })
      .parse(req.body);
    const app = await queryOne<any>(
      'SELECT a.id, r.company_id FROM applications a JOIN recruitments r ON r.id = a.recruitment_id WHERE a.id = ?',
      [id]
    );
    if (!app) throw new HttpError(404, 'Lamaran tidak ditemukan');
    if (!canManageCompany(req.user!, app.company_id)) throw new HttpError(403, 'Kamu tidak punya akses');
    await execute('UPDATE applications SET status = ? WHERE id = ?', [status, id]);
    res.json({ data: { id, status } });
  })
);

export default router;
