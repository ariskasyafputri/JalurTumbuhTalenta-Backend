import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('jalurtumbuh'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET minimal 16 karakter'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  SUPER_ADMIN_EMAIL: z.string().default('superadmin@example.com'),
  SUPER_ADMIN_PASSWORD: z.string().default(''),
});

export const env = schema.parse(process.env);
