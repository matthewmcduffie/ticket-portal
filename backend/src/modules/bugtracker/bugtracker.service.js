import { getDB } from '../../config/database.js';

export async function listSoftware() {
  const db = getDB();
  const result = await db.query(
    `SELECT id, name, url, created_at, updated_at
     FROM bug_tracker_software
     ORDER BY LOWER(name) ASC`
  );
  return result.rows;
}

export async function createSoftware({ name, url }) {
  const db = getDB();
  const result = await db.query(
    `INSERT INTO bug_tracker_software (name, url)
     VALUES ($1, NULLIF($2, ''))
     RETURNING id, name, url, created_at, updated_at`,
    [name.trim(), url?.trim() || '']
  );
  return result.rows[0];
}

export async function deleteSoftware(id) {
  const db = getDB();
  await db.query('DELETE FROM bug_tracker_software WHERE id = $1', [id]);
}
