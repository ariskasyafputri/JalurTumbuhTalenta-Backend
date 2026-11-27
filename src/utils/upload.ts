import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { HttpError } from './http';

const cvDir = path.resolve(process.cwd(), 'uploads', 'cv');
fs.mkdirSync(cvDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cvDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const userId = req.user?.id ?? 'anon';
    cb(null, `cv-user-${userId}-${Date.now()}${ext}`);
  },
});

export const uploadCv = multer({
  storage,
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
