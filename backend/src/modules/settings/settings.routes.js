import { Router } from 'express';
import { getSettings, updateSetting } from './settings.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.get('/', requireAuth, getSettings);
router.patch('/:key', requireAuth, requireRole('admin'), updateSetting);

export default router;
