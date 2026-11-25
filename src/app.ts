import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import applicationRoutes from './modules/applications/applications.routes';
import authRoutes from './modules/auth/auth.routes';
import companyRoutes from './modules/companies/companies.routes';
import recruitmentRoutes from './modules/recruitments/recruitments.routes';
import superAdminRoutes from './modules/superadmin/superadmin.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/recruitments', recruitmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/superadmin', superAdminRoutes);

app.use(notFound);
app.use(errorHandler);
