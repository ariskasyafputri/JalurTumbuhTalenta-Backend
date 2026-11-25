import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validasi gagal',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Data sudah ada (duplikat)' });
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
}
