import { getDB } from '../../config/database.js';

const PRIORITY_COLOR = { critical: 0xE53E3E, high: 0xED8936, medium: 0xECC94B, low: 0x48BB78 };
const PRIORITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

async function getWebhookUrl() {
  const db = getDB();
  const r = await db.query(`SELECT value FROM app_settings WHERE key = 'discord_webhook_url'`);
  return r.rows[0]?.value || process.env.DISCORD_WEBHOOK_URL || null;
}

async function getSetting(key) {
  const db = getDB();
  const r = await db.query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}

export async function sendTicketNotification({ ticket, creatorName, eventType = 'created' }) {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;

  if (eventType === 'created' && (await getSetting('discord_notify_on_create')) !== 'true') return;
  if (eventType === 'updated' && (await getSetting('discord_notify_on_update')) !== 'true') return;

  const color    = PRIORITY_COLOR[ticket.priority] || 0x64748b;
  const emoji    = PRIORITY_EMOJI[ticket.priority] || '⚪';
  const shortId  = `#${ticket.id.slice(0, 6).toUpperCase()}`;
  const isNew    = eventType === 'created';

  const payload = {
    username: 'Ticket Portal',
    embeds: [{
      title: isNew ? '🎫 New Support Ticket' : '🔄 Ticket Updated',
      color,
      fields: [
        { name: 'Subject',       value: ticket.title,                                             inline: false },
        { name: 'Submitted by',  value: creatorName,                                              inline: true  },
        { name: 'Severity',      value: `${emoji} ${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`, inline: true },
        { name: 'Status',        value: ticket.status.replace('_', ' '),                          inline: true  },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `Ticket ${shortId}` },
    }],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook ${res.status}: ${text}`);
  }
}

export async function sendEquipmentNotification({ request }) {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;
  if ((await getSetting('discord_notify_equipment')) !== 'true') return;

  const items   = (request.items || []).join(', ') || '—';
  const dueDate = request.due_date
    ? new Date(request.due_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const payload = {
    username: 'Ticket Portal',
    embeds: [{
      title: '📦 Equipment Request',
      color: 0x0f766e,
      fields: [
        { name: 'New Hire',   value: request.hire_name,       inline: true },
        { name: 'Department', value: request.hire_department, inline: true },
        { name: 'Requestor',  value: request.requestor_name,  inline: true },
        { name: 'Items',      value: items,                   inline: false },
        { name: 'Due Date',   value: dueDate,                 inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Equipment Request  ·  Ticket Portal' },
    }],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook ${res.status}: ${text}`);
  }
}

export async function sendTestMessage() {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) throw new Error('Discord webhook URL is not configured.');

  const payload = {
    username: 'Ticket Portal',
    embeds: [{
      title: '✅ Test Message',
      color: 0x48BB78,
      description: 'Discord integration is working correctly.',
      fields: [
        { name: 'Subject',      value: 'Test ticket subject',  inline: false },
        { name: 'Submitted by', value: 'Test User',            inline: true  },
        { name: 'Severity',     value: '🟡 Medium',            inline: true  },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Ticket Portal · Test' },
    }],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook ${res.status}: ${text}`);
  }
}

export async function getDiscordConfig() {
  const db = getDB();
  const rows = await db.query(
    `SELECT key, value FROM app_settings WHERE key IN ('discord_webhook_url','discord_notify_on_create','discord_notify_on_update','discord_notify_equipment')`
  );
  return Object.fromEntries(rows.rows.map(r => [r.key, r.value]));
}

export async function saveDiscordConfig(updates) {
  const db = getDB();
  const allowed = ['discord_webhook_url', 'discord_notify_on_create', 'discord_notify_on_update', 'discord_notify_equipment'];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    await db.query(
      `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
      [value, key]
    );
  }
}
