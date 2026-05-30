import { getDB } from '../../config/database.js';

export async function listTickets({ userId, role, page = 1, limit = 20, status, priority }) {
  const db = getDB();
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  let query = `
    SELECT t.*, u.name AS creator_name, a.name AS assignee_name
    FROM tickets t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN users a ON t.assigned_to = a.id
  `;

  if (role !== 'admin') {
    params.push(userId);
    conditions.push(`t.created_by = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`t.priority = $${params.length}`);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');

  query += ' ORDER BY t.created_at DESC';
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return result.rows;
}

export async function getTicketById(id) {
  const db = getDB();
  const result = await db.query(
    `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
     FROM tickets t
     LEFT JOIN users u ON t.created_by = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createTicket({ title, description, priority = 'medium', createdBy }) {
  const db = getDB();
  const result = await db.query(
    `INSERT INTO tickets (title, description, priority, status, created_by)
     VALUES ($1, $2, $3, 'open', $4) RETURNING *`,
    [title, description, priority, createdBy]
  );
  return result.rows[0];
}

export async function updateTicket(id, updates, userRole, userId) {
  const db = getDB();
  const ticket = await getTicketById(id);
  if (!ticket) return null;
  if (userRole !== 'admin' && ticket.created_by !== userId) return null;

  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (!fields.length) return ticket;

  values.push(id);
  const result = await db.query(
    `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteTicket(id) {
  const db = getDB();
  await db.query('DELETE FROM tickets WHERE id = $1', [id]);
}
