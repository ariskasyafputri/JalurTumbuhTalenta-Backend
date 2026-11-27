import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler, HttpError, parseId } from '../../utils/http';
import { uploadCv } from '../../utils/upload';

const router = Router();
router.use(authenticate, authorize('candidate'));

function calcCompletion(profile: any, expCount: number) {
  const checks = [
    Boolean(profile?.phone),
    Boolean(profile?.gender),
    Boolean(profile?.birth_date),
    Boolean(profile?.province_id),
    Boolean(profile?.address),
    Boolean(profile?.headline),
    Boolean(profile?.summary),
    Boolean(profile?.education_level && profile?.institution),
    Boolean(profile?.skills),
    Boolean(profile?.cv_path),
    expCount > 0 || Boolean(profile?.portfolio_url) || Boolean(profile?.certifications),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

async function getFullCandidateProfile(userId: number) {
  const user = await queryOne<any>('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  let profile = await queryOne<any>(
    `SELECT cp.*, p.name AS province_name
     FROM candidate_profiles cp
     LEFT JOIN provinces p ON p.id = cp.province_id
     WHERE cp.user_id = ?`,
    [userId]
  );
  if (!profile) {
    await execute('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
    profile = await queryOne<any>('SELECT * FROM candidate_profiles WHERE user_id = ?', [userId]);
  }
  const experiences = await query<any>(
    'SELECT * FROM candidate_experiences WHERE user_id = ? ORDER BY is_current DESC, start_date DESC',
    [userId]
  );
  const completion = calcCompletion(profile, experiences.length);
  return { user, profile, experiences, completion };
}

// GET /api/candidate/profile
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const data = await getFullCandidateProfile(req.user!.id);
    res.json({ data });
  })
);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  gender: z.enum(['Laki-laki', 'Perempuan']).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').nullable().optional(),
  provinceId: z.coerce.number().int().positive().nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  headline: z.string().trim().max(180).nullable().optional(),
  summary: z.string().trim().max(5000).nullable().optional(),
  educationLevel: z.string().trim().max(80).nullable().optional(),
  institution: z.string().trim().max(160).nullable().optional(),
  major: z.string().trim().max(120).nullable().optional(),
  graduationYear: z.string().trim().max(10).nullable().optional(),
  certifications: z.string().trim().max(5000).nullable().optional(),
  skills: z.string().trim().max(2000).nullable().optional(),
  portfolioUrl: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('URL portfolio tidak valid').max(255).nullable().optional()),
  linkedinUrl: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('URL LinkedIn tidak valid').max(255).nullable().optional()),
});

// PUT /api/candidate/profile
router.put(
  '/profile',
  asyncHandler(async (req, res) => {
    const d = profileSchema.parse(req.body);
    const userId = req.user!.id;

    if (d.name) {
      await execute('UPDATE users SET name = ? WHERE id = ?', [d.name, userId]);
    }

    const exists = await queryOne('SELECT id FROM candidate_profiles WHERE user_id = ?', [userId]);
    if (!exists) {
      await execute('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
    }

    await execute(
      `UPDATE candidate_profiles SET
        phone = ?, gender = ?, birth_date = ?, province_id = ?, address = ?,
        headline = ?, summary = ?, education_level = ?, institution = ?,
        major = ?, graduation_year = ?, certifications = ?, skills = ?,
        portfolio_url = ?, linkedin_url = ?
       WHERE user_id = ?`,
      [
        d.phone ?? null,
        d.gender ?? null,
        d.birthDate ?? null,
        d.provinceId ?? null,
        d.address ?? null,
        d.headline ?? null,
        d.summary ?? null,
        d.educationLevel ?? null,
        d.institution ?? null,
        d.major ?? null,
        d.graduationYear ?? null,
        d.certifications ?? null,
        d.skills ?? null,
        d.portfolioUrl ?? null,
        d.linkedinUrl ?? null,
        userId,
      ]
    );

    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

// POST /api/candidate/cv (Upload file CV PDF/DOC/DOCX)
router.post(
  '/cv',
  uploadCv.single('cv'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File CV wajib diunggah');
    const userId = req.user!.id;
    const cvPath = `/uploads/cv/${req.file.filename}`;

    const exists = await queryOne('SELECT id FROM candidate_profiles WHERE user_id = ?', [userId]);
    if (!exists) {
      await execute('INSERT INTO candidate_profiles (user_id, cv_path) VALUES (?, ?)', [userId, cvPath]);
    } else {
      await execute('UPDATE candidate_profiles SET cv_path = ? WHERE user_id = ?', [cvPath, userId]);
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data, cvPath });
  })
);

// ---- PENGALAMAN KERJA (candidate_experiences) ----
const expSchema = z.object({
  jobTitle: z.string().trim().min(2, 'Jabatan wajib diisi').max(150),
  companyName: z.string().trim().min(2, 'Nama perusahaan wajib diisi').max(150),
  employmentType: z.string().trim().max(50).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').nullable().optional(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().trim().max(3000).nullable().optional(),
});

router.post(
  '/experiences',
  asyncHandler(async (req, res) => {
    const d = expSchema.parse(req.body);
    const userId = req.user!.id;
    await execute(
      `INSERT INTO candidate_experiences
       (user_id, job_title, company_name, employment_type, start_date, end_date, is_current, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        d.jobTitle,
        d.companyName,
        d.employmentType ?? null,
        d.startDate,
        d.isCurrent ? null : d.endDate ?? null,
        d.isCurrent ? 1 : 0,
        d.description ?? null,
      ]
    );
    const data = await getFullCandidateProfile(userId);
    res.status(201).json({ data });
  })
);

router.delete(
  '/experiences/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const userId = req.user!.id;
    const r = await execute('DELETE FROM candidate_experiences WHERE id = ? AND user_id = ?', [id, userId]);
    if (!r.affectedRows) throw new HttpError(404, 'Pengalaman kerja tidak ditemukan');
    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

export default router;
