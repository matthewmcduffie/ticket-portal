import { getDB } from '../../config/database.js';

export function canUseProjects(user) {
  return user?.role === 'admin' || !!user?.can_use_projects;
}

export async function projectsEnabled() {
  const db = getDB();
  const r = await db.query(`SELECT value FROM app_settings WHERE key = 'projects_enabled'`);
  return r.rows[0]?.value === 'true';
}

async function logEvent(db, { projectTicketId, userId, eventType, detail }) {
  let userName = 'System';
  if (userId) {
    const u = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    if (u.rows[0]) userName = u.rows[0].name;
  }
  await db.query(
    `INSERT INTO project_ticket_events (project_ticket_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [projectTicketId, userId, userName, eventType, detail]
  );
}

// ── Membership ───────────────────────────────────────────────
export async function getMembership(projectId, userId) {
  const db = getDB();
  const r = await db.query(
    `SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'`,
    [projectId, userId]
  );
  return r.rows[0] || null;
}

export async function getProjectMembers(projectId) {
  const db = getDB();
  const r = await db.query(
    `SELECT pm.role, pm.status, pm.created_at AS member_since, u.id, u.name, u.email
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY (pm.role = 'owner') DESC, (pm.status = 'active') DESC, pm.created_at ASC`,
    [projectId]
  );
  return r.rows;
}

// ── Projects ─────────────────────────────────────────────────
export async function listProjectsForUser(userId) {
  const db = getDB();
  const projects = (await db.query(
    `SELECT p.*, pm.role AS my_role
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1 AND pm.status = 'active'
     ORDER BY p.updated_at DESC`,
    [userId]
  )).rows;

  for (const project of projects) {
    project.members = await getProjectMembers(project.id);
  }
  return projects;
}

export async function getProjectById(id) {
  const db = getDB();
  const r = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
  return r.rows[0] || null;
}

export async function createProject({ name, summary, description, ownerId }) {
  const db = getDB();
  const project = (await db.query(
    `INSERT INTO projects (name, summary, description) VALUES ($1, $2, $3) RETURNING *`,
    [name, summary || null, description || null]
  )).rows[0];

  await db.query(
    `INSERT INTO project_members (project_id, user_id, role, status, invited_by) VALUES ($1, $2, 'owner', 'active', $2)`,
    [project.id, ownerId]
  );

  return { ...project, my_role: 'owner', members: await getProjectMembers(project.id) };
}

export async function updateProject(id, updates) {
  const db = getDB();
  const allowed = ['name', 'summary', 'description'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (!fields.length) return getProjectById(id);
  values.push(id);
  await db.query(
    `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
    values
  );
  return getProjectById(id);
}

export async function deleteProject(id) {
  await getDB().query('DELETE FROM projects WHERE id = $1', [id]);
}

export async function addMember(projectId, targetUserId, invitedBy) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO project_members (project_id, user_id, role, status, invited_by)
     VALUES ($1, $2, 'member', 'invited', $3)
     ON CONFLICT (project_id, user_id) DO NOTHING
     RETURNING *`,
    [projectId, targetUserId, invitedBy]
  );
  return r.rows[0] || null;
}

export async function removeMember(projectId, targetUserId) {
  await getDB().query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND role <> 'owner'`,
    [projectId, targetUserId]
  );
}

// ── Project tickets ──────────────────────────────────────────
export async function listProjectTickets(projectId, { status, priority, issueType, labelId, milestoneId } = {}) {
  const db = getDB();
  const params = [projectId];
  const conditions = ['t.project_id = $1'];
  let join = '';

  if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
  if (priority) { params.push(priority); conditions.push(`t.priority = $${params.length}`); }
  if (issueType) { params.push(issueType); conditions.push(`t.issue_type = $${params.length}`); }
  if (milestoneId) { params.push(milestoneId); conditions.push(`t.milestone_id = $${params.length}`); }
  if (labelId) {
    join = 'JOIN project_ticket_labels ptl ON ptl.project_ticket_id = t.id';
    params.push(labelId);
    conditions.push(`ptl.label_id = $${params.length}`);
  }

  const r = await db.query(
    `SELECT t.*, u.name AS creator_name, a.name AS assignee_name, m.name AS milestone_name
     FROM project_tickets t
     LEFT JOIN users u ON t.created_by = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     LEFT JOIN project_milestones m ON t.milestone_id = m.id
     ${join}
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC`,
    params
  );
  for (const ticket of r.rows) {
    ticket.labels = await getTicketLabels(ticket.id);
  }
  return r.rows;
}

export async function getProjectTicketById(id) {
  const db = getDB();
  const r = await db.query(
    `SELECT t.*, u.name AS creator_name, a.name AS assignee_name, m.name AS milestone_name
     FROM project_tickets t
     LEFT JOIN users u ON t.created_by = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     LEFT JOIN project_milestones m ON t.milestone_id = m.id
     WHERE t.id = $1`,
    [id]
  );
  const ticket = r.rows[0];
  if (!ticket) return null;
  ticket.labels = await getTicketLabels(ticket.id);
  return ticket;
}

export async function createProjectTicket({ projectId, title, description, priority = 'medium', issueType = 'ticket', dueDate = null, milestoneId = null, createdBy }) {
  const db = getDB();
  const ticket = (await db.query(
    `INSERT INTO project_tickets (project_id, title, description, priority, issue_type, due_date, milestone_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [projectId, title, description || null, priority, issueType, dueDate, milestoneId, createdBy]
  )).rows[0];

  await logEvent(db, {
    projectTicketId: ticket.id,
    userId: createdBy,
    eventType: 'created',
    detail: issueType === 'bug' ? 'Bug opened' : 'Ticket opened',
  });

  return getProjectTicketById(ticket.id);
}

export async function updateProjectTicket(id, updates, userId) {
  const db = getDB();
  const ticket = await getProjectTicketById(id);
  if (!ticket) return null;

  const normalized = { ...updates };
  if (normalized.assigned_to === '') normalized.assigned_to = null;
  if (normalized.milestone_id === '') normalized.milestone_id = null;
  if (normalized.due_date === '') normalized.due_date = null;

  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'milestone_id'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (normalized[key] !== undefined) {
      values.push(normalized[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (!fields.length) return ticket;

  values.push(id);
  await db.query(
    `UPDATE project_tickets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
    values
  );
  const updated = await getProjectTicketById(id);

  if (updates.status && updates.status !== ticket.status) {
    await logEvent(db, {
      projectTicketId: id,
      userId,
      eventType: 'status_changed',
      detail: `Status changed from "${ticket.status.replace(/_/g, ' ')}" to "${updates.status.replace(/_/g, ' ')}"`,
    });
  }

  if (updates.priority && updates.priority !== ticket.priority) {
    await logEvent(db, {
      projectTicketId: id,
      userId,
      eventType: 'priority_changed',
      detail: `Priority changed from "${ticket.priority}" to "${updates.priority}"`,
    });
  }

  if (normalized.assigned_to !== undefined && normalized.assigned_to !== ticket.assigned_to) {
    if (normalized.assigned_to) {
      const a = await db.query('SELECT name FROM users WHERE id = $1', [normalized.assigned_to]);
      await logEvent(db, { projectTicketId: id, userId, eventType: 'assigned', detail: `Assigned to ${a.rows[0]?.name ?? 'Unknown'}` });
    } else {
      await logEvent(db, { projectTicketId: id, userId, eventType: 'assigned', detail: 'Unassigned' });
    }
  }

  return updated;
}

export async function getProjectTicketEvents(ticketId) {
  const db = getDB();
  return (await db.query(
    `SELECT * FROM project_ticket_events WHERE project_ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  )).rows;
}

const MENTION_RE = /@([a-z0-9._-]+)/gi;

async function notifyMentions({ ticket, comment, authorId, authorName }) {
  const handles = [...comment.matchAll(MENTION_RE)].map(m => m[1].toLowerCase());
  if (!handles.length) return;

  const members = await getProjectMembers(ticket.project_id);
  const project = await getProjectById(ticket.project_id);

  for (const member of members) {
    if (member.id === authorId) continue;
    const firstName = member.name.split(/\s+/)[0].toLowerCase();
    const emailLocal = member.email.split('@')[0].toLowerCase();
    if (!handles.includes(firstName) && !handles.includes(emailLocal)) continue;

    const { notifyProjectMention } = await import('../email/email.service.js');
    try {
      await notifyProjectMention({
        projectName: project.name,
        ticket,
        comment,
        authorName,
        recipientEmail: member.email,
      });
    } catch (err) { console.error('Mention notification failed:', err.message); }
  }
}

export async function addProjectTicketComment(ticketId, body, userId) {
  const db = getDB();
  const u = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
  const userName = u.rows[0]?.name ?? 'Unknown';
  const trimmed = body.trim();
  const r = await db.query(
    `INSERT INTO project_ticket_events (project_ticket_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, 'comment', $4) RETURNING *`,
    [ticketId, userId, userName, trimmed]
  );

  const ticket = await getProjectTicketById(ticketId);
  notifyMentions({ ticket, comment: trimmed, authorId: userId, authorName: userName })
    .catch(err => console.error('Mention notification failed:', err.message));

  return r.rows[0];
}

// ── Attachments ──────────────────────────────────────────────
export async function listProjectTicketAttachments(projectTicketId) {
  const db = getDB();
  return (await db.query(
    `SELECT * FROM ticket_attachments WHERE project_ticket_id = $1 ORDER BY created_at ASC`,
    [projectTicketId]
  )).rows;
}

// ── Invitations (accept / decline) ───────────────────────────
export async function listPendingInvitations(userId) {
  const db = getDB();
  return (await db.query(
    `SELECT pm.id, pm.project_id, pm.created_at AS invited_at,
            p.name AS project_name, p.summary AS project_summary,
            inviter.name AS invited_by_name
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     LEFT JOIN users inviter ON inviter.id = pm.invited_by
     WHERE pm.user_id = $1 AND pm.status = 'invited'
     ORDER BY pm.created_at DESC`,
    [userId]
  )).rows;
}

export async function acceptInvitation(projectId, userId) {
  const db = getDB();
  const r = await db.query(
    `UPDATE project_members SET status = 'active'
     WHERE project_id = $1 AND user_id = $2 AND status = 'invited'
     RETURNING *`,
    [projectId, userId]
  );
  return r.rows[0] || null;
}

export async function declineInvitation(projectId, userId) {
  const db = getDB();
  const r = await db.query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND status = 'invited' RETURNING id`,
    [projectId, userId]
  );
  return r.rowCount > 0;
}

// ── Polls ────────────────────────────────────────────────────
export async function listPolls(projectId, userId) {
  const db = getDB();
  const polls = (await db.query(
    `SELECT pl.*, u.name AS creator_name
     FROM project_polls pl
     LEFT JOIN users u ON u.id = pl.created_by
     WHERE pl.project_id = $1
     ORDER BY pl.created_at DESC`,
    [projectId]
  )).rows;

  for (const poll of polls) {
    const options = (await db.query(
      `SELECT o.id, o.text, o.position, COUNT(v.id)::int AS vote_count
       FROM project_poll_options o
       LEFT JOIN project_poll_votes v ON v.option_id = o.id
       WHERE o.poll_id = $1
       GROUP BY o.id
       ORDER BY o.position ASC`,
      [poll.id]
    )).rows;
    const myVote = (await db.query(
      `SELECT option_id FROM project_poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [poll.id, userId]
    )).rows[0];
    poll.options = options;
    poll.total_votes = options.reduce((sum, o) => sum + o.vote_count, 0);
    poll.my_vote = myVote?.option_id || null;
  }
  return polls;
}

export async function getPollById(id) {
  const db = getDB();
  return (await db.query('SELECT * FROM project_polls WHERE id = $1', [id])).rows[0] || null;
}

export async function createPoll(projectId, { question, options }, createdBy) {
  const db = getDB();
  const poll = (await db.query(
    `INSERT INTO project_polls (project_id, question, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [projectId, question, createdBy]
  )).rows[0];

  let position = 0;
  for (const text of options) {
    await db.query(
      `INSERT INTO project_poll_options (poll_id, text, position) VALUES ($1, $2, $3)`,
      [poll.id, text, position++]
    );
  }
  return poll;
}

export async function votePoll(pollId, optionId, userId) {
  const db = getDB();
  await db.query(
    `INSERT INTO project_poll_votes (poll_id, option_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
    [pollId, optionId, userId]
  );
}

export async function closePoll(pollId) {
  await getDB().query(`UPDATE project_polls SET closed_at = NOW() WHERE id = $1`, [pollId]);
}

export async function deletePoll(pollId) {
  await getDB().query('DELETE FROM project_polls WHERE id = $1', [pollId]);
}

// ── Labels ───────────────────────────────────────────────────
export async function listLabels(projectId) {
  const db = getDB();
  return (await db.query(
    `SELECT * FROM project_labels WHERE project_id = $1 ORDER BY name ASC`,
    [projectId]
  )).rows;
}

export async function createLabel(projectId, { name, color }) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO project_labels (project_id, name, color) VALUES ($1, $2, $3)
     ON CONFLICT (project_id, name) DO NOTHING RETURNING *`,
    [projectId, name, color || '#6d28d9']
  );
  return r.rows[0] || null;
}

export async function deleteLabel(labelId) {
  await getDB().query('DELETE FROM project_labels WHERE id = $1', [labelId]);
}

export async function getLabelById(id) {
  const db = getDB();
  return (await db.query('SELECT * FROM project_labels WHERE id = $1', [id])).rows[0] || null;
}

export async function setTicketLabels(projectTicketId, labelIds) {
  const db = getDB();
  await db.query('DELETE FROM project_ticket_labels WHERE project_ticket_id = $1', [projectTicketId]);
  for (const labelId of labelIds) {
    await db.query(
      `INSERT INTO project_ticket_labels (project_ticket_id, label_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectTicketId, labelId]
    );
  }
}

export async function getTicketLabels(projectTicketId) {
  const db = getDB();
  return (await db.query(
    `SELECT l.* FROM project_ticket_labels tl
     JOIN project_labels l ON l.id = tl.label_id
     WHERE tl.project_ticket_id = $1
     ORDER BY l.name ASC`,
    [projectTicketId]
  )).rows;
}

// ── Milestones ───────────────────────────────────────────────
export async function listMilestones(projectId) {
  const db = getDB();
  return (await db.query(
    `SELECT m.*,
            COUNT(t.id)::int AS ticket_count,
            COUNT(t.id) FILTER (WHERE t.status = 'closed')::int AS closed_count
     FROM project_milestones m
     LEFT JOIN project_tickets t ON t.milestone_id = m.id
     WHERE m.project_id = $1
     GROUP BY m.id
     ORDER BY (m.target_date IS NULL), m.target_date ASC, m.created_at ASC`,
    [projectId]
  )).rows;
}

export async function createMilestone(projectId, { name, description, target_date }) {
  const db = getDB();
  return (await db.query(
    `INSERT INTO project_milestones (project_id, name, description, target_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [projectId, name, description || null, target_date || null]
  )).rows[0];
}

export async function getMilestoneById(id) {
  const db = getDB();
  return (await db.query('SELECT * FROM project_milestones WHERE id = $1', [id])).rows[0] || null;
}

export async function updateMilestone(id, updates) {
  const db = getDB();
  const allowed = ['name', 'description', 'target_date'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (!fields.length) return getMilestoneById(id);
  values.push(id);
  await db.query(`UPDATE project_milestones SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  return getMilestoneById(id);
}

export async function deleteMilestone(id) {
  await getDB().query('DELETE FROM project_milestones WHERE id = $1', [id]);
}

// ── Activity feed ────────────────────────────────────────────
export async function getProjectActivity(projectId, limit = 50) {
  const db = getDB();
  return (await db.query(
    `SELECT e.*, t.title AS ticket_title, t.issue_type
     FROM project_ticket_events e
     JOIN project_tickets t ON t.id = e.project_ticket_id
     WHERE t.project_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [projectId, limit]
  )).rows;
}
