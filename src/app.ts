import path from 'path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import adminRoutes from './modules/admin/admin.routes';
import applicationRoutes from './modules/applications/applications.routes';
import authRoutes from './modules/auth/auth.routes';
import candidateRoutes from './modules/candidate/candidate.routes';
import companyRoutes from './modules/companies/companies.routes';
import masterRoutes from './modules/master/master.routes';
import recruitmentRoutes from './modules/recruitments/recruitments.routes';
import superAdminRoutes from './modules/superadmin/superadmin.routes';

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Static folder untuk CV kandidat yang di-upload
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/master', masterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/recruitments', recruitmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);

app.use(notFound);
app.use(errorHandler);
