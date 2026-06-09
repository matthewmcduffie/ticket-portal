import { Router } from 'express';
import { addSoftware, getSoftware, removeSoftware } from './bugtracker.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth);

router.get('/software', getSoftware);
router.post('/software', requireRole('admin', 'technician'), addSoftware);
router.delete('/software/:id', requireRole('admin', 'technician'), removeSoftware);

export default router;
