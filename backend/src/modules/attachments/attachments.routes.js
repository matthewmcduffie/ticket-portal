import { Router } from 'express';
import { getConfig, getSignedUrl, downloadAttachment, deleteAttachment } from './attachments.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const router = Router();

// Cookie-auth required for config, signed-URL generation, and deletion
router.get('/config',      requireAuth, getConfig);
router.get('/:id/signed',  requireAuth, getSignedUrl);
router.delete('/:id',      requireAuth, requireRole('admin', 'technician'), deleteAttachment);

// Download: requireAuth is applied only when no signed token is present (handled inside controller)
router.get('/:id', (req, res, next) => {
  if (req.query.token && req.query.exp) {
    // Signed-URL path — skip cookie auth, controller validates HMAC
    return downloadAttachment(req, res, next);
  }
  requireAuth(req, res, () => downloadAttachment(req, res, next));
});

export default router;
