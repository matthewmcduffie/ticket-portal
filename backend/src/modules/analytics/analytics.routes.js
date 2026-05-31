import { Router } from 'express';
import { overview } from './analytics.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.get('/overview', requireAuth, requireRole('admin'), overview);

export default router;
