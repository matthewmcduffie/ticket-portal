import { getDB } from '../../config/database.js';

// ── Email notifications (graceful — never blocks ticket ops) ──
async function tryNotify(fn) {
  if (!process.env.AGENTMAIL_API_KEY) return;
  try { await fn(); } catch (err) { console.error('Email notification failed:', err.message); }
}

async function creatorEmail(db, userId) {
  const r = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.email || null;
}

// ── Event logging ──────────────────────────────────────────
async function logEvent(db, { ticketId, userId, eventType, detail }) {
  let userName = 'System';
  if (userId) {
    const u = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    if (u.rows[0]) userName = u.rows[0].name;
  }
  await db.query(
    `INSERT INTO ticket_events (ticket_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, userId, userName, eventType, detail]
  );
}

// ── Access control ─────────────────────────────────────────
export async function canAccessTicket(ticketId, userId) {
  const db = getDB();
  const r = await db.query(
    `SELECT 1 FROM tickets t
     LEFT JOIN ticket_shares ts ON ts.ticket_id = t.id AND ts.shared_with = $2
     WHERE t.id = $1 AND (t.created_by = $2 OR ts.shared_with IS NOT NULL)`,
    [ticketId, userId]
  );
  return r.rows.length > 0;
}

// ── Sharing ────────────────────────────────────────────────
export async function shareTicket(ticketId, targetUserId, sharedBy) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO ticket_shares (ticket_id, shared_with, shared_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (ticket_id, shared_with) DO NOTHING
     RETURNING *`,
    [ticketId, targetUserId, sharedBy]
  );
  return r.rows[0] || null;
}

export async function unshareTicket(ticketId, targetUserId) {
  const db = getDB();
  await db.query(
    'DELETE FROM ticket_shares WHERE ticket_id = $1 AND shared_with = $2',
    [ticketId, targetUserId]
  );
}

export async function getTicketShares(ticketId) {
  const db = getDB();
  const r = await db.query(
    `SELECT u.id, u.name, u.email, ts.created_at AS shared_at
     FROM ticket_shares ts
     JOIN users u ON u.id = ts.shared_with
     WHERE ts.ticket_id = $1
     ORDER BY ts.created_at ASC`,
    [ticketId]
  );
  return r.rows;
}

// ── Queries ────────────────────────────────────────────────
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
    WHERE t.deleted_at IS NULL
  `;

  if (role !== 'admin') {
    params.push(userId);
    conditions.push(
      `(t.created_by = $${params.length} OR EXISTS (
         SELECT 1 FROM ticket_shares ts WHERE ts.ticket_id = t.id AND ts.shared_with = $${params.length}
       ))`
    );
  }
  if (status) { params.push(status);   conditions.push(`t.status = $${params.length}`); }
  if (priority) { params.push(priority); conditions.push(`t.priority = $${params.length}`); }

  if (conditions.length) query += ' AND ' + conditions.join(' AND ');
  query += ' ORDER BY t.created_at DESC';
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  return (await db.query(query, params)).rows;
}

export async function getTicketById(id) {
  const db = getDB();
  const r = await db.query(
    `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
     FROM tickets t
     LEFT JOIN users u ON t.created_by = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id]
  );
  return r.rows[0] || null;
}

export async function getTicketEvents(ticketId) {
  const db = getDB();
  return (await db.query(
    `SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  )).rows;
}

export async function getRecentActivity(limit = 15) {
  const db = getDB();
  return (await db.query(
    `SELECT te.*, t.title AS ticket_title
     FROM ticket_events te
     JOIN tickets t ON te.ticket_id = t.id
     ORDER BY te.created_at DESC
     LIMIT $1`,
    [limit]
  )).rows;
}

export async function createTicket({ title, description, priority = 'medium', createdBy }) {
  const db = getDB();
  const ticket = (await db.query(
    `INSERT INTO tickets (title, description, priority, status, created_by)
     VALUES ($1, $2, $3, 'open', $4) RETURNING *`,
    [title, description, priority, createdBy]
  )).rows[0];

  await logEvent(db, { ticketId: ticket.id, userId: createdBy, eventType: 'created', detail: 'Ticket opened' });

  tryNotify(async () => {
    const { notifyTicketCreated } = await import('../email/email.service.js');
    const email = await creatorEmail(db, createdBy);
    if (email) await notifyTicketCreated({ ticket, creatorEmail: email });
  });

  tryNotify(async () => {
    const { sendTicketNotification } = await import('../discord/discord.service.js');
    const u = await db.query('SELECT name FROM users WHERE id = $1', [createdBy]);
    await sendTicketNotification({ ticket, creatorName: u.rows[0]?.name ?? 'Unknown', eventType: 'created' });
  });

  tryNotify(async () => {
    const { sendTicketNotification } = await import('../slack/slack.service.js');
    const u = await db.query('SELECT name FROM users WHERE id = $1', [createdBy]);
    await sendTicketNotification({ ticket, creatorName: u.rows[0]?.name ?? 'Unknown', eventType: 'created' });
  });

  return ticket;
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
  const updated = (await db.query(
    `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values
  )).rows[0];

  if (updates.status && updates.status !== ticket.status) {
    await logEvent(db, {
      ticketId: id, userId, eventType: 'status_changed',
      detail: `Status changed from "${ticket.status.replace('_', ' ')}" to "${updates.status.replace('_', ' ')}"`,
    });
    tryNotify(async () => {
      const { notifyStatusChanged } = await import('../email/email.service.js');
      const email = await creatorEmail(db, ticket.created_by);
      if (email) await notifyStatusChanged({ ticket: updated, creatorEmail: email, oldStatus: ticket.status, newStatus: updates.status });
    });
  }

  if (updates.priority && updates.priority !== ticket.priority) {
    await logEvent(db, {
      ticketId: id, userId, eventType: 'priority_changed',
      detail: `Priority changed from "${ticket.priority}" to "${updates.priority}"`,
    });
  }

  if (updates.assigned_to !== undefined && updates.assigned_to !== ticket.assigned_to) {
    if (updates.assigned_to) {
      const a = await db.query('SELECT name FROM users WHERE id = $1', [updates.assigned_to]);
      await logEvent(db, { ticketId: id, userId, eventType: 'assigned', detail: `Assigned to ${a.rows[0]?.name ?? 'Unknown'}` });
    } else {
      await logEvent(db, { ticketId: id, userId, eventType: 'assigned', detail: 'Ticket unassigned' });
    }
  }

  return updated;
}

export async function mergeTickets(primaryId, ticketIds, userId) {
  const db = getDB();
  const primary = await getTicketById(primaryId);
  if (!primary) return null;

  const merged = [];

  for (const tid of ticketIds) {
    if (tid === primaryId) continue;
    const t = await getTicketById(tid);
    if (!t) continue;

    // Close the merged ticket and point it at the primary
    await db.query(
      `UPDATE tickets SET status = 'closed', merged_into = $1, updated_at = NOW() WHERE id = $2`,
      [primaryId, tid]
    );

    await logEvent(db, {
      ticketId: tid, userId, eventType: 'merged',
      detail: `Ticket merged into #${primaryId.slice(0, 6).toUpperCase()} — "${primary.title}"`,
    });

    merged.push(t);

    // Notify the merged ticket's creator
    tryNotify(async () => {
      const { notifyTicketMerged } = await import('../email/email.service.js');
      const email = await creatorEmail(db, t.created_by);
      if (email) await notifyTicketMerged({ mergedTicket: t, primaryTicket: primary, creatorEmail: email });
    });
  }

  if (merged.length > 0) {
    const refs = merged.map(t => `"${t.title}" (#${t.id.slice(0, 6).toUpperCase()})`).join(', ');
    await logEvent(db, {
      ticketId: primaryId, userId, eventType: 'merged',
      detail: `Merged ${merged.length} related ticket${merged.length > 1 ? 's' : ''} into this one: ${refs}`,
    });
  }

  return { primary, merged };
}

export async function addComment(ticketId, body, userId, userRole) {
  const db = getDB();
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;
  if (userRole !== 'admin' && !(await canAccessTicket(ticketId, userId))) return null;

  const u = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
  const userName = u.rows[0]?.name ?? 'Unknown';

  const result = await db.query(
    `INSERT INTO ticket_events (ticket_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, 'comment', $4) RETURNING *`,
    [ticketId, userId, userName, body.trim()]
  );

  // Notify ticket creator when an admin responds (not when creator comments on their own ticket)
  if (userRole === 'admin' && ticket.created_by !== userId) {
    tryNotify(async () => {
      const { notifyTicketComment } = await import('../email/email.service.js');
      const creator = await db.query('SELECT email FROM users WHERE id = $1', [ticket.created_by]);
      if (creator.rows[0]?.email) {
        await notifyTicketComment({ ticket, comment: body, responderName: userName, creatorEmail: creator.rows[0].email });
      }
    });
  }

  return result.rows[0];
}

export async function deleteTicket(id) {
  // Soft delete — preserves ticket_events audit trail and ticket_shares
  await getDB().query(
    'UPDATE tickets SET deleted_at = NOW() WHERE id = $1',
    [id]
  );
}
