import {
  authenticateUser, signToken, validatePassword,
  createRefreshToken, validateRefreshToken, revokeRefreshToken,
  consumePasswordResetToken,
} from './auth.service.js';
import { logAudit } from '../audit/audit.service.js';
import { getDB } from '../../config/database.js';
import bcrypt from 'bcryptjs';

const ACCESS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 60 * 1000, // 30 minutes
  path: '/',
};

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth', // restrict to auth endpoints only
};

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await authenticateUser(email, password);

    if (!result) {
      logAudit({ action: 'login_failed', resourceType: 'auth', ip: req.ip, userName: email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (result.locked) {
      logAudit({ action: 'login_blocked', resourceType: 'auth', ip: req.ip, userName: email });
      return res.status(429).json({ error: 'Account temporarily locked. Try again in 15 minutes.' });
    }

    const token = signToken(result);
    const refreshRaw = await createRefreshToken(result.id);

    res.cookie('token', token, ACCESS_COOKIE);
    res.cookie('refresh_token', refreshRaw, REFRESH_COOKIE);

    logAudit({
      userId: result.id,
      userName: result.email,
      action: 'login',
      resourceType: 'auth',
      ip: req.ip,
    });

    res.json({
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
        must_change_password: result.must_change_password,
        can_view_bug_reports: result.can_view_bug_reports,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function logout(req, res) {
  logAudit({
    userId: req.user?.id,
    userName: req.user?.email,
    action: 'logout',
    resourceType: 'auth',
    ip: req.ip,
  });
  await revokeRefreshToken(req.cookies?.refresh_token).catch(() => {});
  res.clearCookie('token', { ...ACCESS_COOKIE, maxAge: 0 });
  res.clearCookie('refresh_token', { ...REFRESH_COOKIE, maxAge: 0 });
  res.json({ ok: true });
}

export async function refresh(req, res) {
  try {
    const raw = req.cookies?.refresh_token;
    const row = await validateRefreshToken(raw);
    if (!row) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const user = {
      id: row.uid,
      email: row.email,
      name: row.name,
      role: row.role,
      can_view_bug_reports: row.can_view_bug_reports,
    };
    const token = signToken(user);
    res.cookie('token', token, ACCESS_COOKIE);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function me(req, res) {
  try {
    const db = getDB();
    const result = await db.query(
      'SELECT id, email, name, role, must_change_password, can_view_bug_reports, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }

    const error = validatePassword(new_password);
    if (error) return res.status(400).json({ error });

    const db = getDB();
    const r = await db.query('SELECT * FROM users WHERE id = $1 AND active = true', [req.user.id]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (current_password === new_password) {
      return res.status(400).json({ error: 'New password must differ from current password' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2`,
      [hash, req.user.id]
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.email,
      action: 'change_password',
      resourceType: 'auth',
      ip: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'token and new_password required' });
    }

    const err = validatePassword(new_password);
    if (err) return res.status(400).json({ error: err });

    const row = await consumePasswordResetToken(token);
    if (!row) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

    const db = getDB();
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash(new_password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2`,
      [hash, row.user_id]
    );

    logAudit({
      userId:       row.user_id,
      userName:     row.email,
      action:       'reset_password',
      resourceType: 'auth',
      ip:           req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
