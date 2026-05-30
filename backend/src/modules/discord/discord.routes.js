import { Router } from 'express';
import { testDiscord, getConfig, updateConfig } from './discord.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/',       getConfig);
router.patch('/',     updateConfig);
router.post('/test',  testDiscord);

export default router;
