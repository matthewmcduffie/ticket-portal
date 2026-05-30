import { Router } from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from './users.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
