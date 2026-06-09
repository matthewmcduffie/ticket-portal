import XLSX from 'xlsx';
import * as svc from './users.service.js';
import { unlockAccount, createPasswordResetToken } from '../auth/auth.service.js';
import { logAudit } from '../audit/audit.service.js';

// ── Shared helper ─────────────────────────────────────────────
async function sendInviteEmail(user) {
  if (!process.env.AGENTMAIL_API_KEY) return;
  try {
    const raw    = await createPasswordResetToken(user.id);
    const domain = process.env.APP_DOMAIN || 'tickets.thelastpatch.com';
    const link   = `https://${domain}/reset-password?token=${raw}`;
    const { sendEmail } = await import('../email/email.service.js');
    await sendEmail({
      to:      user.email,
      subject: 'You\'ve been added to the support portal',
      text:    `Hi ${user.name},\n\nYou've been added to the support portal. Set your password using the link below (it expires in 1 hour):\n\n${link}\n\nIf you didn't expect this, you can ignore this email safely.`,
      html:    `<p>Hi ${user.name},</p><p>You've been added to the support portal. <a href="${link}">Set your password</a> — the link expires in 1 hour.</p><p>If you didn't expect this, you can ignore it safely.</p>`,
    });
  } catch (err) {
    console.error('Failed to send invite email:', err.message);
  }
}

// ── Handlers ──────────────────────────────────────────────────
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
    const { email, name, password, role, can_view_bug_reports, can_use_projects, set_password } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    const adminSetPassword = !!(set_password && password);
    const user = await svc.createUser({
      email,
      name,
      password: adminSetPassword ? password : null,
      role,
      can_view_bug_reports,
      can_use_projects,
      must_change_password: !adminSetPassword,
    });

    if (!adminSetPassword) {
      await sendInviteEmail(user);
    }

    logAudit({
      userId:       req.user.id,
      userName:     req.user.email,
      action:       'create_user',
      resourceType: 'user',
      resourceId:   user.id,
      ip:           req.ip,
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'WEAK_PASSWORD') return res.status(400).json({ error: err.message });
    if (err.code === '23505')         return res.status(409).json({ error: 'Email already in use' });
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
    const target = await svc.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await svc.deleteUser(req.params.id);

    logAudit({
      userId:       req.user.id,
      userName:     req.user.email,
      action:       'delete_user',
      resourceType: 'user',
      resourceId:   req.params.id,
      ip:           req.ip,
    });

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

export async function importUsers(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let rows;
  try {
    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows        = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  } catch {
    return res.status(400).json({ error: 'Could not parse file. Upload a .csv or .xlsx file.' });
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const name  = String(row[0] ?? '').trim();
    const email = String(row[1] ?? '').trim().toLowerCase();
    if (!name || !email || !email.includes('@')) { skipped++; continue; }

    try {
      const user = await svc.createUser({ name, email, must_change_password: true });
      await sendInviteEmail(user);
      logAudit({
        userId:       req.user.id,
        userName:     req.user.email,
        action:       'import_user',
        resourceType: 'user',
        resourceId:   user.id,
        ip:           req.ip,
      });
      created++;
    } catch (err) {
      // Silently skip duplicate emails and other row-level failures
      skipped++;
    }
  }

  res.json({ created, skipped });
}
