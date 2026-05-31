import { Router } from 'express';
import { handleWebhook, triggerPoll, getStatus, setupWebhook, testEmail } from './email.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

// Validate the shared webhook secret set in .env (WEBHOOK_SECRET).
// Configure AgentMail to send: Authorization: Bearer <WEBHOOK_SECRET>
function requireWebhookSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next(); // secret not yet configured — allow through
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/webhook', requireWebhookSecret, handleWebhook);

// Admin-only management endpoints
router.get('/status',          requireAuth, requireRole('admin'), getStatus);
router.post('/poll',           requireAuth, requireRole('admin'), triggerPoll);
router.post('/test',           requireAuth, requireRole('admin'), testEmail);
router.post('/setup-webhook',  requireAuth, requireRole('admin'), setupWebhook);

export default router;
