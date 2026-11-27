import { Router } from 'express';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/http';

const router = Router();

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const data = await query('SELECT id, name FROM job_categories ORDER BY name ASC');
    res.json({ data });
  })
);

router.get(
  '/employment-types',
  asyncHandler(async (_req, res) => {
    const data = await query('SELECT id, name FROM employment_types ORDER BY id ASC');
    res.json({ data });
  })
);

router.get(
  '/provinces',
  asyncHandler(async (_req, res) => {
    const data = await query('SELECT id, name FROM provinces ORDER BY id ASC');
    res.json({ data });
  })
);

router.get(
  '/all',
  asyncHandler(async (_req, res) => {
    const [categories, employmentTypes, provinces] = await Promise.all([
      query('SELECT id, name FROM job_categories ORDER BY name ASC'),
      query('SELECT id, name FROM employment_types ORDER BY id ASC'),
      query('SELECT id, name FROM provinces ORDER BY id ASC'),
    ]);
    res.json({ categories, employmentTypes, provinces });
  })
);

export default router;
