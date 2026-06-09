import bcrypt from 'bcryptjs';
import { getDB } from '../../config/database.js';
import { validatePassword } from '../auth/auth.service.js';

const SAFE_FIELDS = 'id, email, name, role, active, must_change_password, can_view_bug_reports, can_use_projects, created_at';

export async function listUsers() {
  const db = getDB();
  const result = await db.query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY created_at DESC`);
  return result.rows;
}

export async function getUserById(id) {
  const db = getDB();
  const result = await db.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function createUser({ email, name, password, role = 'user', can_view_bug_reports = false, can_use_projects = false }) {
  const err = validatePassword(password);
  if (err) throw Object.assign(new Error(err), { code: 'WEAK_PASSWORD' });

  const db = getDB();
  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (email, name, password_hash, role, must_change_password, can_view_bug_reports, can_use_projects)
     VALUES ($1, $2, $3, $4, TRUE, $5, $6)
     RETURNING ${SAFE_FIELDS}`,
    [email.toLowerCase(), name, hash, role, can_view_bug_reports, can_use_projects]
  );
  return result.rows[0];
}

export async function updateUser(id, updates) {
  const db = getDB();
  const fields = [];
  const values = [];
  const allowed = ['name', 'email', 'role', 'active', 'can_view_bug_reports', 'can_use_projects'];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (updates.password) {
    const err = validatePassword(updates.password);
    if (err) throw Object.assign(new Error(err), { code: 'WEAK_PASSWORD' });
    const hash = await bcrypt.hash(updates.password, 12);
    values.push(hash);
    fields.push(`password_hash = $${values.length}`);
    // Admin password reset — require change on next login
    values.push(true);
    fields.push(`must_change_password = $${values.length}`);
  }
  if (!fields.length) return getUserById(id);

  values.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${SAFE_FIELDS}`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteUser(id) {
  const db = getDB();
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}
