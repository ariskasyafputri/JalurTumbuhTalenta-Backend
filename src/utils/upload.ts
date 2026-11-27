import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { HttpError } from './http';

// Pastikan semua folder upload tersedia
const cvDir = path.resolve(process.cwd(), 'uploads', 'cv');
const avatarDir = path.resolve(process.cwd(), 'uploads', 'avatars');
const logoDir = path.resolve(process.cwd(), 'uploads', 'logos');
const certDir = path.resolve(process.cwd(), 'uploads', 'certificates');
const portfolioDir = path.resolve(process.cwd(), 'uploads', 'portfolios');

fs.mkdirSync(cvDir, { recursive: true });
fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(logoDir, { recursive: true });
fs.mkdirSync(certDir, { recursive: true });
fs.mkdirSync(portfolioDir, { recursive: true });

// Helper hapus file lama agar disk tidak penuh
export function deleteFileIfExists(relativePath?: string | null) {
  if (!relativePath) return;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const fullPath = path.resolve(process.cwd(), cleanPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

// 1. UPLOAD CV
const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cvDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const userId = req.user?.id ?? 'anon';
    cb(null, `cv-user-${userId}-${Date.now()}${ext}`);
  },
});

export const uploadCv = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Format CV harus PDF, DOC, atau DOCX (maks 5MB)'));
    }
  },
});

// Filter umum untuk gambar (JPG, PNG, WEBP)
const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new HttpError(400, 'Format gambar harus JPG, PNG, atau WEBP (maks 2MB)'));
  }
};

// 2. UPLOAD FOTO PROFIL KANDIDAT
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const userId = req.user?.id ?? 'anon';
    cb(null, `avatar-user-${userId}-${Date.now()}${ext}`);
  },
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
  fileFilter: imageFileFilter,
});

// 3. UPLOAD LOGO PERUSAHAAN
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const companyId = req.params.id ?? 'company';
    cb(null, `logo-company-${companyId}-${Date.now()}${ext}`);
  },
});

export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
  fileFilter: imageFileFilter,
});

// 4. UPLOAD FILE SERTIFIKAT (PDF, JPG, PNG)
const certStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, certDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const userId = req.user?.id ?? 'anon';
    cb(null, `cert-user-${userId}-${Date.now()}${ext}`);
  },
});

export const uploadCertificate = multer({
  storage: certStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Format sertifikat harus PDF, JPG, atau PNG (maks 5MB)'));
    }
  },
});

// 5. UPLOAD PDF PORTFOLIO
const portfolioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, portfolioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const userId = req.user?.id ?? 'anon';
    cb(null, `portfolio-user-${userId}-${Date.now()}${ext}`);
  },
});

export const uploadPortfolio = multer({
  storage: portfolioStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'File portfolio harus berformat PDF (maks 5MB)'));
    }
  },
});