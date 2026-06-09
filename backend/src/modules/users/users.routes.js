import { Router } from 'express';
import multer from 'multer';
import { getUsers, getUser, createUser, updateUser, deleteUser, unlockUser, sendPasswordReset, importUsers } from './users.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Read-only: admins and technicians
router.get('/',    requireAuth, requireRole('admin', 'technician'), getUsers);
router.get('/:id', requireAuth, requireRole('admin', 'technician'), getUser);

// Write operations: admins only
router.post('/',                    requireAuth, requireRole('admin'), createUser);
router.post('/import',              requireAuth, requireRole('admin'), upload.single('file'), importUsers);
router.patch('/:id',                requireAuth, requireRole('admin'), updateUser);
router.delete('/:id',               requireAuth, requireRole('admin'), deleteUser);
router.post('/:id/unlock',          requireAuth, requireRole('admin'), unlockUser);
router.post('/:id/send-reset',      requireAuth, requireRole('admin'), sendPasswordReset);

export default router;
