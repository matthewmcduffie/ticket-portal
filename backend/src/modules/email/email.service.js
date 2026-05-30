import { getDB } from '../../config/database.js';

const BASE = 'https://api.agentmail.to';

function inboxId() {
  return process.env.AGENTMAIL_INBOX_ID;
}

async function am(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AgentMail ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── HTML template ──────────────────────────────────────────
function html(heading, bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f7f9fb;">
  <div style="max-width:580px;margin:32px auto;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#1a3461;padding:18px 24px;">
      <h1 style="color:#fff;margin:0;font-size:17px;font-weight:600;">Ticket Portal</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#191c1e;">${heading}</h2>
      ${bodyHtml}
    </div>
    <div style="background:#f2f4f6;padding:12px 24px;font-size:12px;color:#76777d;border-top:1px solid #e2e8f0;">
      You received this because you have an open ticket with Ticket Portal. Please do not reply directly — reply to the ticket thread instead.
    </div>
  </div>
</body></html>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 0;font-size:14px;color:#45464d;width:120px;">${label}</td><td style="padding:6px 0;font-size:14px;color:#191c1e;font-weight:600;">${value}</td></tr>`;
}

function table(rows) {
  return `<table style="border-collapse:collapse;margin-bottom:20px;">${rows}</table>`;
}

function shortId(id) {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

// ── Send helpers ───────────────────────────────────────────
export async function sendEmail({ to, subject, text, html: htmlBody }) {
  return am(`/inboxes/${inboxId()}/messages/send`, 'POST', {
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html: htmlBody,
  });
}

export async function replyToMessage(messageId, { text: textBody, html: htmlBody }) {
  return am(`/inboxes/${inboxId()}/messages/${messageId}/reply`, 'POST', {
    text: textBody,
    html: htmlBody,
  });
}

// ── Notification templates ─────────────────────────────────
export async function notifyTicketCreated({ ticket, creatorEmail }) {
  const id = shortId(ticket.id);
  const subject = `[Ticket Portal] Ticket ${id} opened`;
  const text = `Your support ticket has been received.\n\nTicket: ${ticket.title}\nID: ${id}\nPriority: ${ticket.priority}\n\nWe will update you by email as things progress.`;
  const htmlBody = html(
    `Your ticket has been opened`,
    `<p style="font-size:14px;color:#45464d;margin:0 0 20px;">We received your request and it's in the queue.</p>
    ${table(row('Ticket', ticket.title) + row('ID', id) + row('Priority', ticket.priority) + row('Status', 'Open'))}`
  );
  return sendEmail({ to: creatorEmail, subject, text, html: htmlBody });
}

export async function notifyStatusChanged({ ticket, creatorEmail, oldStatus, newStatus }) {
  const id = shortId(ticket.id);
  const subject = `[Ticket Portal] Ticket ${id} updated — ${newStatus.replace('_', ' ')}`;
  const text = `Your ticket status has been updated.\n\nTicket: ${ticket.title}\nID: ${id}\nStatus: ${oldStatus.replace('_', ' ')} → ${newStatus.replace('_', ' ')}`;
  const htmlBody = html(
    `Ticket status updated`,
    `${table(
      row('Ticket', ticket.title) +
      row('ID', id) +
      row('Previous', oldStatus.replace('_', ' ')) +
      row('New status', `<strong>${newStatus.replace('_', ' ')}</strong>`)
    )}`
  );
  return sendEmail({ to: creatorEmail, subject, text, html: htmlBody });
}

export async function notifyTicketMerged({ mergedTicket, primaryTicket, creatorEmail }) {
  const mid = shortId(mergedTicket.id);
  const pid = shortId(primaryTicket.id);
  const subject = `[Ticket Portal] Ticket ${mid} merged`;
  const text = `Your ticket has been merged with a related issue and will be tracked together.\n\nYour ticket: ${mergedTicket.title} (${mid})\nConsolidated under: ${primaryTicket.title} (${pid})`;
  const htmlBody = html(
    `Your ticket has been merged`,
    `<p style="font-size:14px;color:#45464d;margin:0 0 20px;">Your ticket was merged with a related issue. It will be tracked and resolved together.</p>
    ${table(
      row('Your ticket', `${mergedTicket.title} (${mid})`) +
      row('Merged into', `${primaryTicket.title} (${pid})`)
    )}`
  );
  return sendEmail({ to: creatorEmail, subject, text, html: htmlBody });
}

// ── Email → ticket ─────────────────────────────────────────
export async function processIncomingMessage(message) {
  const db = getDB();

  // Skip if already processed
  if (message.labels?.includes('processed')) return null;

  const senderEmail = message.from?.email?.toLowerCase();
  const subject     = (message.subject || 'Support request').trim();
  const body        = message.text || message.snippet || '';

  if (!senderEmail) return null;

  // Find or create user
  let user = (await db.query('SELECT id, name FROM users WHERE email = $1', [senderEmail])).rows[0];
  if (!user) {
    const name = message.from?.name || senderEmail.split('@')[0];
    const hash = await (await import('bcryptjs')).default.hash(Math.random().toString(36), 10);
    user = (await db.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'user') RETURNING id, name`,
      [senderEmail, name, hash]
    )).rows[0];
    console.log(`Created user from inbound email: ${senderEmail}`);
  }

  // Create ticket (bypass notification since we reply inline)
  const ticketRes = await db.query(
    `INSERT INTO tickets (title, description, priority, status, created_by)
     VALUES ($1, $2, 'medium', 'open', $3) RETURNING *`,
    [subject.slice(0, 500), body.slice(0, 5000), user.id]
  );
  const ticket = ticketRes.rows[0];

  // Log creation event
  await db.query(
    `INSERT INTO ticket_events (ticket_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, 'created', 'Ticket opened via email')`,
    [ticket.id, user.id, user.name]
  );

  // Reply to the thread with confirmation
  const id = shortId(ticket.id);
  try {
    await replyToMessage(message.message_id, {
      text: `Your support ticket has been opened.\n\nTicket: ${subject}\nID: ${id}\n\nWe will be in touch.`,
      html: html(`Your ticket ${id} has been opened`, `${table(row('Subject', subject) + row('ID', id) + row('Status', 'Open'))}<p style="font-size:14px;color:#45464d;">We will respond to this thread when there are updates.</p>`),
    });
  } catch (err) {
    console.error('Reply failed:', err.message);
  }

  // Mark message as processed
  try {
    await am(`/inboxes/${inboxId()}/messages/${message.message_id}`, 'PATCH', {
      add_labels: ['processed'],
    });
  } catch (err) {
    console.error('Label failed:', err.message);
  }

  console.log(`Ticket ${id} created from email: ${senderEmail}`);
  return ticket;
}

// ── Poll for new unprocessed messages ──────────────────────
export async function pollInbox() {
  const data = await am(`/inboxes/${inboxId()}/messages`);
  const unprocessed = (data.messages || []).filter(m => !m.labels?.includes('processed'));
  const results = [];
  for (const msg of unprocessed) {
    const ticket = await processIncomingMessage(msg);
    if (ticket) results.push(ticket);
  }
  return results;
}

// ── Inbox info ──────────────────────────────────────────────
export async function getInboxInfo() {
  return am(`/inboxes/${inboxId()}`);
}

// ── Webhook registration ────────────────────────────────────
export async function registerWebhook(url) {
  // Check if already registered
  const existing = await am('/webhooks');
  const already = (existing.webhooks || []).find(w => w.url === url);
  if (already) {
    console.log(`Webhook already registered: ${url}`);
    return already;
  }
  const result = await am('/webhooks', 'POST', {
    url,
    event_types: ['message.received'],
  });
  console.log(`Webhook registered: ${url}`);
  return result;
}
