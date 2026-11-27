import { NextFunction, Request, Response } from 'express';
import { query, queryOne } from '../config/db';
import { AuthUser, CompanyMembership, Role } from '../types';
import { verifyToken } from '../utils/auth';
import { HttpError } from '../utils/http';

export async function getUserWithCompanies(userId: number): Promise<AuthUser | null> {
  const u = await queryOne<any>(
    'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
    [userId]
  );
  if (!u || !u.is_active) return null;

  let companies: CompanyMembership[] = [];
  if (u.role === 'company') {
    const rows = await query<any>(
      `SELECT cm.company_id, c.name AS company_name, cm.member_role
       FROM company_members cm
       JOIN companies c ON c.id = cm.company_id
       WHERE cm.user_id = ?
       ORDER BY cm.id ASC`,
      [u.id]
    );
    companies = rows.map((r) => ({
      companyId: r.company_id,
      companyName: r.company_name,
      memberRole: r.member_role,
    }));
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    companies,
  };
}

async function loadUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  let id: number;
  try {
    id = Number(verifyToken(header.slice(7)).sub);
  } catch {
    throw new HttpError(401, 'Token tidak valid atau kedaluwarsa');
  }
  const user = await getUserWithCompanies(id);
  if (!user) throw new HttpError(401, 'Akun tidak ditemukan atau dinonaktifkan');
  return user;
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

/** admin & super_admin boleh kelola semua perusahaan; company boleh kelola perusahaan yang terhubung dengannya */
export const canManageCompany = (u: AuthUser, companyId: number) =>
  u.role === 'super_admin' ||
  u.role === 'admin' ||
  (u.role === 'company' && u.companies.some((c) => c.companyId === companyId));
