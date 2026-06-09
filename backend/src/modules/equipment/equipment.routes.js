import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { listRequests, createRequest, getRequest, updateRequest, deleteRequest, addComment } from './equipment.controller.js';
import { equipmentEnabled } from './equipment.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin', 'technician'));

async function requireEnabled(req, res, next) {
  try {
    if (!(await equipmentEnabled())) return res.status(403).json({ error: 'Equipment Requests are currently disabled' });
    next();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

router.use(requireEnabled);

router.get('/',              listRequests);
router.post('/',             createRequest);
router.get('/:id',           getRequest);
router.patch('/:id',         updateRequest);
router.delete('/:id',        deleteRequest);
router.post('/:id/comments', addComment);

export default router;
