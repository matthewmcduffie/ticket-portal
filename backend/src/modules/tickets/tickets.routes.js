import { Router } from 'express';
import {
  getTickets, getTicket, createTicket, updateTicket, deleteTicket,
  getTicketEvents, getRecentActivity, mergeTickets, addComment,
} from './tickets.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

router.use(requireAuth);

router.get('/activity', requireRole('admin'), getRecentActivity);

router.get('/',     getTickets);
router.post('/',    createTicket);

router.get('/:id',           getTicket);
router.patch('/:id',         updateTicket);
router.delete('/:id',        requireRole('admin'), deleteTicket);
router.get('/:id/events',    getTicketEvents);
router.post('/:id/comments', addComment);
router.post('/:id/merge',    requireRole('admin'), mergeTickets);

export default router;
