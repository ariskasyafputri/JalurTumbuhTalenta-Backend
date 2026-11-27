import { app } from './app';
import { pool } from './config/db';
import { env } from './config/env';

async function main() {
  await pool.query('SELECT 1');
  app.listen(env.PORT, () => console.log(`API Jalurtumbuh berjalan di http://localhost:${env.PORT}`));
}

main().catch((e) => {
  console.error('Gagal start server:', e);
  process.exit(1);
});
