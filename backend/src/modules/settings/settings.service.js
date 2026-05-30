import { getDB } from '../../config/database.js';

export async function getAllSettings() {
  const db = getDB();
  const result = await db.query(
    'SELECT key, value, description FROM app_settings ORDER BY key'
  );
  return result.rows;
}

export async function updateSetting(key, value) {
  const db = getDB();
  const result = await db.query(
    `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
    [value, key]
  );
  return result.rows[0] || null;
}
