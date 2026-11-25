import { execute, pool, queryOne } from '../src/config/db';
import { env } from '../src/config/env';
import { hashPassword } from '../src/utils/auth';

// Super admin tidak bisa register lewat API, dibuat lewat script ini.
async function main() {
  if (env.SUPER_ADMIN_PASSWORD.length < 8) throw new Error('Isi SUPER_ADMIN_PASSWORD (min 8 karakter) di .env');
  const email = env.SUPER_ADMIN_EMAIL.toLowerCase();
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    console.log('Super admin sudah ada:', email);
  } else {
    await execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'super_admin')", [
      env.SUPER_ADMIN_NAME,
      email,
      await hashPassword(env.SUPER_ADMIN_PASSWORD),
    ]);
    console.log('Super admin dibuat:', email);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
