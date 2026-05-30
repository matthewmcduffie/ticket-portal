import { Router } from 'express';
import { testSlack, getConfig, updateConfig } from './slack.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/',      getConfig);
router.patch('/',    updateConfig);
router.post('/test', testSlack);

export default router;
