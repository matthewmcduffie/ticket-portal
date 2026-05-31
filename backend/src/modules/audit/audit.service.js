import { getDB } from '../../config/database.js';

export async function logAudit({ userId, userName, action, resourceType, resourceId, ip }) {
  try {
    await getDB().query(
      `INSERT INTO audit_log (user_id, user_name, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId ?? null, userName ?? 'unknown', action, resourceType, resourceId ?? null, ip ?? null]
    );
  } catch (err) {
    // Audit failures must never block the main request
    console.error('Audit log error:', err.message);
  }
}
