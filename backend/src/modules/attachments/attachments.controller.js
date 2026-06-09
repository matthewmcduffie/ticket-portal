import * as svc from './attachments.service.js';
import { logAudit } from '../audit/audit.service.js';
import { createHmac } from 'crypto';

const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour

function signedToken(attachmentId, exp) {
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(`${attachmentId}:${exp}`)
    .digest('hex');
}

export async function getConfig(req, res) {
  try {
    res.json(await svc.getUploadConfig());
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getSignedUrl(req, res) {
  try {
    const att = await svc.getAttachment(req.params.id);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    if (!(await svc.canAccessAttachment(att, req.user))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exp   = Date.now() + SIGNED_URL_TTL_MS;
    const token = signedToken(att.id, exp);
    const url   = `/api/attachments/${att.id}?token=${token}&exp=${exp}`;
    res.json({ url, expires: new Date(exp).toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function downloadAttachment(req, res) {
  try {
    const att = await svc.getAttachment(req.params.id);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    // Signed-URL path: validate HMAC + expiry, skip cookie auth
    const { token, exp } = req.query;
    if (token && exp) {
      const expMs = parseInt(exp, 10);
      if (isNaN(expMs) || Date.now() > expMs) {
        return res.status(401).json({ error: 'Download link has expired' });
      }
      const expected = signedToken(att.id, expMs);
      if (token !== expected) {
        return res.status(401).json({ error: 'Invalid download token' });
      }
      // Signed URL is valid — skip permission check, go straight to stream
    } else {
      // Cookie-auth path
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await svc.canAccessAttachment(att, req.user))) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    logAudit({
      userId: req.user?.id,
      userName: req.user?.email,
      action: 'download_attachment',
      resourceType: 'attachment',
      resourceId: att.id,
      ip: req.ip,
    });

    const inline = req.query.inline === 'true';
    svc.streamAttachment(att, res, inline);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteAttachment(req, res) {
  try {
    const ok = await svc.removeAttachment(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Attachment not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
