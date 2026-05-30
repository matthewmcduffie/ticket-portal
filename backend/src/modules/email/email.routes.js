import { Router } from 'express';
import { handleWebhook, triggerPoll, getStatus, setupWebhook, testEmail } from './email.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

// AgentMail calls this — no auth
router.post('/webhook', handleWebhook);

// Admin-only management endpoints
router.get('/status',          requireAuth, requireRole('admin'), getStatus);
router.post('/poll',           requireAuth, requireRole('admin'), triggerPoll);
router.post('/test',           requireAuth, requireRole('admin'), testEmail);
router.post('/setup-webhook',  requireAuth, requireRole('admin'), setupWebhook);

export default router;
