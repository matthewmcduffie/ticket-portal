import * as svc from './users.service.js';
import { unlockAccount, createPasswordResetToken } from '../auth/auth.service.js';
import { logAudit } from '../audit/audit.service.js';

export async function getUsers(req, res) {
  try {
    res.json(await svc.listUsers());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUser(req, res) {
  try {
    const user = await svc.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createUser(req, res) {
  try {
    const { email, name, password, role, can_view_bug_reports } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password required' });
    }
    const user = await svc.createUser({ email, name, password, role, can_view_bug_reports });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'WEAK_PASSWORD') return res.status(400).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateUser(req, res) {
  try {
    const user = await svc.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    if (err.code === 'WEAK_PASSWORD') return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await svc.deleteUser(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function unlockUser(req, res) {
  try {
    const user = await svc.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    unlockAccount(user.email);
    logAudit({
      userId:       req.user.id,
      userName:     req.user.email,
      action:       'unlock_account',
      resourceType: 'user',
      resourceId:   user.id,
      ip:           req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function sendPasswordReset(req, res) {
  try {
    const user = await svc.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const raw    = await createPasswordResetToken(user.id);
    const domain = process.env.APP_DOMAIN || 'tickets.thelastpatch.com';
    const link   = `https://${domain}/reset-password?token=${raw}`;

    if (process.env.AGENTMAIL_API_KEY) {
      const { sendEmail } = await import('../email/email.service.js');
      await sendEmail({
        to:      user.email,
        subject: 'Reset your password',
        text:    `Hi ${user.name},\n\nSomeone from the support team has sent you a password reset link. It expires in one hour.\n\n${link}\n\nIf you didn't expect this, you can ignore it.`,
        html:    `<p>Hi ${user.name},</p><p>Someone from the support team has sent you a password reset link. It expires in one hour.</p><p><a href="${link}">Reset my password</a></p><p>If you didn't expect this, you can ignore it safely.</p>`,
      });
    }

    logAudit({
      userId:       req.user.id,
      userName:     req.user.email,
      action:       'send_password_reset',
      resourceType: 'user',
      resourceId:   user.id,
      ip:           req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
