import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { getDB } from '../../config/database.js';

// ── Password validation ────────────────────────────────────
const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123',
  'iloveyou', 'admin123', 'welcome1', 'monkey123', 'dragon123',
  'master123', 'sunshine', 'princess', 'letmein1', 'football',
]);

export function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password))          return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password))          return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password))  return 'Password must contain at least one special character.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Password is too common. Please choose a stronger one.';
  return null; // valid
}

// ── Account-level lockout (in-memory, resets on restart) ──
const attempts = new Map();
const MAX_FAILURES = 5;
const LOCK_MS      = 15 * 60 * 1000;

function getAttempts(email) {
  return attempts.get(email) || { count: 0, lockedUntil: null };
}

export function isAccountLocked(email) {
  const a = getAttempts(email);
  if (!a.lockedUntil) return false;
  if (Date.now() < a.lockedUntil) return true;
  attempts.delete(email);
  return false;
}

function recordFailure(email) {
  const a = getAttempts(email);
  const count = a.count + 1;
  attempts.set(email, {
    count,
    lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : null,
  });
}

function clearAttempts(email) {
  attempts.delete(email);
}

// ── Auth ───────────────────────────────────────────────────
export async function authenticateUser(email, password) {
  if (isAccountLocked(email)) return { locked: true };

  const db = getDB();
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND active = true',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Always run bcrypt to avoid timing attacks that reveal account existence
  const hash = user?.password_hash ?? '$2a$12$invalidhashpaddingtomatch';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    if (user) recordFailure(email.toLowerCase());
    return null;
  }

  clearAttempts(email.toLowerCase());
  return user;
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      can_view_bug_reports: !!user.can_view_bug_reports,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

// ── Refresh tokens ─────────────────────────────────────────
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createRefreshToken(userId) {
  const db = getDB();
  const raw = randomBytes(40).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
  return raw;
}

export async function validateRefreshToken(raw) {
  if (!raw) return null;
  const db = getDB();
  const hash = hashToken(raw);
  const r = await db.query(
    `SELECT rt.*, u.id AS uid, u.email, u.name, u.role, u.active, u.must_change_password, u.can_view_bug_reports
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
       AND u.active = true`,
    [hash]
  );
  return r.rows[0] || null;
}

export async function revokeRefreshToken(raw) {
  if (!raw) return;
  const db = getDB();
  const hash = hashToken(raw);
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
    [hash]
  );
}

export async function revokeAllUserRefreshTokens(userId) {
  const db = getDB();
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

// ── Account unlock ─────────────────────────────────────────
export function unlockAccount(email) {
  attempts.delete(email.toLowerCase());
}

// ── Password reset tokens ──────────────────────────────────
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function createPasswordResetToken(userId) {
  const db = getDB();
  const raw  = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const exp  = new Date(Date.now() + RESET_TTL_MS);
  // Invalidate any existing unused token for this user
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, exp]
  );
  return raw;
}

export async function consumePasswordResetToken(raw) {
  if (!raw) return null;
  const db   = getDB();
  const hash = hashToken(raw);
  const r    = await db.query(
    `SELECT prt.user_id, u.email
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1
       AND prt.used_at IS NULL
       AND prt.expires_at > NOW()`,
    [hash]
  );
  if (!r.rows[0]) return null;
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`,
    [hash]
  );
  return r.rows[0];
}
