import { getDB } from '../../config/database.js';
import { createReadStream, unlink } from 'fs';
import { join } from 'path';

export async function getUploadConfig() {
  const db = getDB();
  const r = await db.query(
    `SELECT key, value FROM app_settings
     WHERE key IN ('uploads_enabled','upload_max_file_size_mb','upload_max_total_size_mb')`
  );
  const m = Object.fromEntries(r.rows.map(row => [row.key, row.value]));
  return {
    enabled:       m.uploads_enabled !== 'false',
    maxFileSizeMb: parseInt(m.upload_max_file_size_mb  || '25'),
    maxTotalSizeMb: parseInt(m.upload_max_total_size_mb || '100'),
  };
}

export function uploadsDir() {
  return process.env.UPLOAD_DIR || '/app/uploads';
}

export async function canAccessAttachment(att, user) {
  if (att.ticket_id) {
    if (user.role === 'admin') return true;
    const { canAccessTicket, canViewBugReports } = await import('../tickets/tickets.service.js');
    return canAccessTicket(att.ticket_id, user.id, {
      role: user.role,
      canViewBugReports: canViewBugReports(user),
    });
  }
  if (att.project_ticket_id) {
    if (user.role === 'admin') return true;
    const { getProjectTicketById, getMembership } = await import('../projects/projects.service.js');
    const ticket = await getProjectTicketById(att.project_ticket_id);
    if (!ticket) return false;
    return !!(await getMembership(ticket.project_id, user.id));
  }
  return false;
}

export async function saveProjectAttachment({ projectTicketId, uploadedBy, file }) {
  const db = getDB();

  const att = (await db.query(
    `INSERT INTO ticket_attachments (project_ticket_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [projectTicketId, uploadedBy, file.originalname, file.filename, file.mimetype, file.size]
  )).rows[0];

  const u = await db.query('SELECT name FROM users WHERE id = $1', [uploadedBy]);
  const userName = u.rows[0]?.name ?? 'Unknown';

  await db.query(
    `INSERT INTO project_ticket_events (project_ticket_id, user_id, user_name, event_type, detail, attachment_id)
     VALUES ($1, $2, $3, 'attachment', $4, $5)`,
    [projectTicketId, uploadedBy, userName, file.originalname, att.id]
  );

  return att;
}

export async function saveAttachment({ ticketId, uploadedBy, file }) {
  const db = getDB();

  const att = (await db.query(
    `INSERT INTO ticket_attachments (ticket_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [ticketId, uploadedBy, file.originalname, file.filename, file.mimetype, file.size]
  )).rows[0];

  const u = await db.query('SELECT name FROM users WHERE id = $1', [uploadedBy]);
  const userName = u.rows[0]?.name ?? 'Unknown';

  await db.query(
    `INSERT INTO ticket_events (ticket_id, user_id, user_name, event_type, detail, attachment_id)
     VALUES ($1, $2, $3, 'attachment', $4, $5)`,
    [ticketId, uploadedBy, userName, file.originalname, att.id]
  );

  return att;
}

export async function listAttachments(ticketId) {
  const db = getDB();
  return (await db.query(
    `SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  )).rows;
}

export async function getAttachment(id) {
  const db = getDB();
  return (await db.query(
    'SELECT * FROM ticket_attachments WHERE id = $1', [id]
  )).rows[0] || null;
}

export async function removeAttachment(id) {
  const att = await getAttachment(id);
  if (!att) return false;
  unlink(join(uploadsDir(), att.stored_name), () => {});
  await getDB().query('DELETE FROM ticket_attachments WHERE id = $1', [id]);
  return true;
}

export function streamAttachment(att, res, inline = false) {
  const filePath = join(uploadsDir(), att.stored_name);
  const disposition = inline ? 'inline' : `attachment; filename="${encodeURIComponent(att.original_name)}"`;
  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Content-Length', att.size_bytes);
  createReadStream(filePath).pipe(res);
}
