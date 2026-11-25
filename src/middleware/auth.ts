import { NextFunction, Request, Response } from 'express';
import { queryOne } from '../config/db';
import { AuthUser, Role } from '../types';
import { verifyToken } from '../utils/auth';
import { HttpError } from '../utils/http';

async function loadUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  let id: number;
  try {
    id = Number(verifyToken(header.slice(7)).sub);
  } catch {
    throw new HttpError(401, 'Token tidak valid atau kedaluwarsa');aku
  }
  // Selalu ambil dari DB supaya perubahan role / akun nonaktif langsung berlaku
  const u = await queryOne<any>(
    'SELECT id, name, email, role, company_id, is_active FROM users WHERE id = ?',
    [id]
  );
  if (!u || !u.is_active) throw new HttpError(401, 'Akun tidak ditemukan atau dinonaktifkan');
  return { id: u.id, name: u.name, email: u.email, role: u.role, companyId: u.company_id };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await loadUser(req);
    if (!user) throw new HttpError(401, 'Silakan login terlebih dahulu');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

/** Login opsional: kalau ada token valid, req.user terisi; kalau tidak ada tetap lanjut. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = (await loadUser(req)) ?? undefined;
    next();
  } catch (e) {
    next(e);
  }
}

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Silakan login terlebih dahulu'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Kamu tidak punya akses'));
    next();
  };

export const isStaff = (u?: AuthUser) =>
  !!u && (u.role === 'super_admin' || u.role === 'company' || u.role === 'admin');

/** super_admin boleh semua perusahaan; company/admin hanya perusahaannya sendiri */
export const canManageCompany = (u: AuthUser, companyId: number) =>
  u.role === 'super_admin' || ((u.role === 'company' || u.role === 'admin') && u.companyId === companyId);
