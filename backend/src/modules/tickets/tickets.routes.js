import { Router } from 'express';
import { getTickets, getTicket, createTicket, updateTicket, deleteTicket } from './tickets.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth);

router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', requireRole('admin'), deleteTicket);

export default router;
