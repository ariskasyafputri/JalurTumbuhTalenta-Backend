import { Router } from 'express';
import { ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { execute, pool, query, queryOne } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { hashPassword } from '../../utils/auth';
import { asyncHandler, HttpError, pagination, parseId } from '../../utils/http';

const router = Router();
router.use(authenticate, authorize('super_admin'));

const roles = ['candidate', 'company', 'admin', 'super_admin'] as const;

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [row] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role='candidate') AS candidates,
        (SELECT COUNT(*) FROM users WHERE role='company') AS company_accounts,
        (SELECT COUNT(*) FROM users WHERE role='admin') AS admins,
        (SELECT COUNT(*) FROM companies) AS companies,
        (SELECT COUNT(*) FROM recruitments) AS recruitments,
        (SELECT COUNT(*) FROM recruitments WHERE status='open') AS open_recruitments,
        (SELECT COUNT(*) FROM applications) AS applications`
    );
    res.json({ data: row });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.role) {
      where.push('u.role = ?');
      params.push(req.query.role);
    }
    if (req.query.q) {
      where.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM users u ${w}`, params);
    const users = await query<any>(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at
       FROM users u ${w} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    for (const u of users) {
      if (u.role === 'company') {
        u.companies = await query(
          `SELECT c.id AS companyId, c.name AS companyName, cm.member_role AS memberRole
           FROM company_members cm JOIN companies c ON c.id = cm.company_id
           WHERE cm.user_id = ?`,
          [u.id]
        );
      } else {
        u.companies = [];
      }
    }

    res.json({ data: users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.enum(roles),
  companyIds: z.array(z.coerce.number().int().positive()).optional(),
});

router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const d = createUserSchema.parse(req.body);
    if (await queryOne('SELECT id FROM users WHERE email = ?', [d.email])) {
      throw new HttpError(409, 'Email sudah terdaftar');
    }

    const conn = await pool.getConnection();
    let userId: number;
    try {
      await conn.beginTransaction();
      const [u] = await conn.query<ResultSetHeader>(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [d.name, d.email, await hashPassword(d.password), d.role]
      );
      userId = u.insertId;
      if (d.role === 'candidate') {
        await conn.query('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
      }
      if (d.role === 'company' && d.companyIds?.length) {
        for (const cid of d.companyIds) {
          await conn.query(
            "INSERT IGNORE INTO company_members (user_id, company_id, member_role) VALUES (?, ?, 'owner')",
            [userId, cid]
          );
        }
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.status(201).json({ data: { id: userId, name: d.name, email: d.email, role: d.role } });
  })
);

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(160).transform((s) => s.toLowerCase()).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(roles).optional(),
  isActive: z.boolean().optional(),
  companyIds: z.array(z.coerce.number().int().positive()).optional(),
});

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const d = updateUserSchema.parse(req.body);
    if (id === req.user!.id && (d.isActive === false || (d.role && d.role !== 'super_admin'))) {
      throw new HttpError(400, 'Tidak bisa menonaktifkan atau menurunkan role akun sendiri');
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name); }
    if (d.email !== undefined) { sets.push('email = ?'); params.push(d.email); }
    if (d.password !== undefined) { sets.push('password_hash = ?'); params.push(await hashPassword(d.password)); }
    if (d.role !== undefined) { sets.push('role = ?'); params.push(d.role); }
    if (d.isActive !== undefined) { sets.push('is_active = ?'); params.push(d.isActive ? 1 : 0); }

    if (sets.length) {
      const r = await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      if (!r.affectedRows) throw new HttpError(404, 'User tidak ditemukan');
    }

    if (d.companyIds !== undefined) {
      await execute('DELETE FROM company_members WHERE user_id = ?', [id]);
      for (const cid of d.companyIds) {
        await execute(
          "INSERT IGNORE INTO company_members (user_id, company_id, member_role) VALUES (?, ?, 'owner')",
          [id, cid]
        );
      }
    }

    res.json({ data: await queryOne('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [id]) });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === req.user!.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri');
    const r = await execute('DELETE FROM users WHERE id = ?', [id]);
    if (!r.affectedRows) throw new HttpError(404, 'User tidak ditemukan');
    res.json({ message: 'User dihapus' });
  })
);

export default router;
