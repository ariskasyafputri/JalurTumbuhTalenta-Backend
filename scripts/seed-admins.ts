import { execute, pool, queryOne } from '../src/config/db';
import { env } from '../src/config/env';
import { hashPassword } from '../src/utils/auth';

async function upsertAdmin(name: string, emailRaw: string, password: string, role: 'super_admin' | 'admin') {
  if (password.length < 8) {
    throw new Error(`Password untuk ${role} minimal 8 karakter di .env`);
  }
  const email = emailRaw.toLowerCase();
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    console.log(`[SKIP] ${role} sudah ada: ${email}`);
  } else {
    await execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      name,
      email,
      await hashPassword(password),
      role,
    ]);
    console.log(`[OK] ${role} dibuat: ${email}`);
  }
}

async function main() {
  await upsertAdmin(env.SUPER_ADMIN_NAME, env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD, 'super_admin');
  await upsertAdmin(env.ADMIN_NAME, env.ADMIN_EMAIL, env.ADMIN_PASSWORD, 'admin');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
