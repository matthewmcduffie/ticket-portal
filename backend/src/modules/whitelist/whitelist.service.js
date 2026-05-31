import { getDB } from '../../config/database.js';

export async function listWhitelist() {
  const db = getDB();
  const r = await db.query(
    `SELECT w.id, w.type, w.value, w.created_at, u.name AS added_by_name
     FROM email_whitelist w
     LEFT JOIN users u ON u.id = w.added_by
     ORDER BY w.type, w.value`
  );
  return r.rows;
}

export async function addEntry({ type, value, addedBy }) {
  const db = getDB();
  const normalized = value.trim().toLowerCase();
  const r = await db.query(
    `INSERT INTO email_whitelist (type, value, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (value) DO NOTHING
     RETURNING *`,
    [type, normalized, addedBy]
  );
  return r.rows[0] || null;
}

export async function removeEntry(id) {
  const db = getDB();
  await db.query('DELETE FROM email_whitelist WHERE id = $1', [id]);
}

// Returns true if the email is allowed, or if the whitelist is empty (open policy).
export async function isAllowed(email) {
  const db = getDB();
  const countR = await db.query('SELECT COUNT(*) FROM email_whitelist');
  if (parseInt(countR.rows[0].count) === 0) return true; // empty = allow all

  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] || '';

  const r = await db.query(
    `SELECT 1 FROM email_whitelist
     WHERE (type = 'email' AND value = $1)
        OR (type = 'domain' AND value = $2)
     LIMIT 1`,
    [lower, domain]
  );
  return r.rows.length > 0;
}
