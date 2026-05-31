import { Router } from 'express';
import { getWhitelist, addToWhitelist, removeFromWhitelist } from './whitelist.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/',     getWhitelist);
router.post('/',    addToWhitelist);
router.delete('/:id', removeFromWhitelist);

export default router;
