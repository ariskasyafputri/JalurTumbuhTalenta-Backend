import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { asyncHandler, HttpError, parseId } from '../../utils/http';
import {
  uploadCv,
  uploadAvatar,
  uploadCertificate,
  uploadPortfolio,
  deleteFileIfExists,
} from '../../utils/upload';

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
    expCount > 0 || Boolean(profile?.portfolio_url) || Boolean(profile?.portfolio_path) || Boolean(profile?.certifications),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function safeJsonParse(val: any, fallback: any[] = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
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

  profile.additional_educations = safeJsonParse(profile.additional_educations, []);
  profile.certification_items = safeJsonParse(profile.certification_items, []);

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
  additionalEducations: z.array(z.any()).optional().default([]),
  certifications: z.string().trim().max(5000).nullable().optional(),
  certificationItems: z.array(z.any()).optional().default([]),
  skills: z.string().trim().max(2000).nullable().optional(),
  portfolioUrl: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('URL portfolio tidak valid').max(255).nullable().optional()),
  portfolioPath: z.string().trim().max(255).nullable().optional(),
  portfolioFileName: z.string().trim().max(255).nullable().optional(),
  linkedinUrl: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('URL LinkedIn tidak valid').max(255).nullable().optional()),
  socialMediaUrl: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('URL sosial media tidak valid').max(255).nullable().optional()),
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
        major = ?, graduation_year = ?, additional_educations = ?,
        certifications = ?, certification_items = ?, skills = ?,
        portfolio_url = ?, portfolio_path = ?, portfolio_file_name = ?,
        linkedin_url = ?, social_media_url = ?
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
        JSON.stringify(d.additionalEducations ?? []),
        d.certifications ?? null,
        JSON.stringify(d.certificationItems ?? []),
        d.skills ?? null,
        d.portfolioUrl ?? null,
        d.portfolioPath ?? null,
        d.portfolioFileName ?? null,
        d.linkedinUrl ?? null,
        d.socialMediaUrl ?? null,
        userId,
      ]
    );

    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

// POST /api/candidate/cv
router.post(
  '/cv',
  uploadCv.single('cv'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File CV wajib diunggah');
    const userId = req.user!.id;
    const cvPath = `/uploads/cv/${req.file.filename}`;

    const existing = await queryOne<{ id: number; cv_path: string | null }>(
      'SELECT id, cv_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );

    if (!existing) {
      await execute('INSERT INTO candidate_profiles (user_id, cv_path) VALUES (?, ?)', [userId, cvPath]);
    } else {
      deleteFileIfExists(existing.cv_path);
      await execute('UPDATE candidate_profiles SET cv_path = ? WHERE user_id = ?', [cvPath, userId]);
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data, cvPath });
  })
);

// DELETE /api/candidate/cv
router.delete(
  '/cv',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const existing = await queryOne<{ id: number; cv_path: string | null }>(
      'SELECT id, cv_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );

    if (existing?.cv_path) {
      deleteFileIfExists(existing.cv_path);
      await execute('UPDATE candidate_profiles SET cv_path = NULL WHERE user_id = ?', [userId]);
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

// POST /api/candidate/photo
router.post(
  '/photo',
  uploadAvatar.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File foto profil wajib diunggah');
    const userId = req.user!.id;
    const photoPath = `/uploads/avatars/${req.file.filename}`;

    const existing = await queryOne<{ id: number; photo_path: string | null }>(
      'SELECT id, photo_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );

    if (!existing) {
      await execute('INSERT INTO candidate_profiles (user_id, photo_path) VALUES (?, ?)', [userId, photoPath]);
    } else {
      deleteFileIfExists(existing.photo_path);
      await execute('UPDATE candidate_profiles SET photo_path = ? WHERE user_id = ?', [photoPath, userId]);
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data, photoPath });
  })
);

// DELETE /api/candidate/photo
router.delete(
  '/photo',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const existing = await queryOne<{ id: number; photo_path: string | null }>(
      'SELECT id, photo_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );

    if (existing?.photo_path) {
      deleteFileIfExists(existing.photo_path);
      await execute('UPDATE candidate_profiles SET photo_path = NULL WHERE user_id = ?', [userId]);
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

// POST /api/candidate/certificates/upload
router.post(
  '/certificates/upload',
  uploadCertificate.single('certificate'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File sertifikat wajib diunggah');
    const url = `/uploads/certificates/${req.file.filename}`;
    res.json({ url, file_path: url, fileName: req.file.originalname });
  })
);

// POST /api/candidate/portfolio
router.post(
  '/portfolio',
  uploadPortfolio.single('portfolio'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File PDF portfolio wajib diunggah');
    const userId = req.user!.id;
    const url = `/uploads/portfolios/${req.file.filename}`;

    const existing = await queryOne<{ id: number; portfolio_path: string | null }>(
      'SELECT id, portfolio_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );
    if (existing?.portfolio_path && existing.portfolio_path !== url) {
      deleteFileIfExists(existing.portfolio_path);
    }

    res.json({ url, file_path: url, portfolio_path: url, fileName: req.file.originalname });
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

// DELETE /api/candidate/certificates/file (Hapus file fisik sertifikat)
router.delete(
  '/certificates/file',
  asyncHandler(async (req, res) => {
    const { fileUrl } = req.body as { fileUrl?: string };
    if (fileUrl && fileUrl.startsWith('/uploads/certificates/')) {
      deleteFileIfExists(fileUrl);
    }
    res.json({ message: 'File sertifikat dihapus' });
  })
);

// DELETE /api/candidate/portfolio (Hapus file PDF portfolio)
router.delete(
  '/portfolio',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const existing = await queryOne<{ id: number; portfolio_path: string | null }>(
      'SELECT id, portfolio_path FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );

    if (existing?.portfolio_path) {
      deleteFileIfExists(existing.portfolio_path);
      await execute(
        'UPDATE candidate_profiles SET portfolio_path = NULL, portfolio_file_name = NULL WHERE user_id = ?',
        [userId]
      );
    }

    const data = await getFullCandidateProfile(userId);
    res.json({ data });
  })
);

export default router;