import { getDB } from '../../config/database.js';

const PRIORITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

async function getSetting(key) {
  const db = getDB();
  const r = await db.query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}

async function getWebhookUrl() {
  return (await getSetting('slack_webhook_url')) || process.env.SLACK_WEBHOOK_URL || null;
}

async function post(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook ${res.status}: ${text}`);
  }
  // Slack returns plain text "ok", not JSON
}

function buildBlocks({ title, ticket, creatorName }) {
  const shortId = `#${ticket.id.slice(0, 6).toUpperCase()}`;
  const emoji   = PRIORITY_EMOJI[ticket.priority] || '⚪';
  const priority = ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1);
  const status   = ticket.status.replace('_', ' ');

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: title, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Subject*\n${ticket.title}` },
          { type: 'mrkdwn', text: `*Submitted by*\n${creatorName}` },
          { type: 'mrkdwn', text: `*Severity*\n${emoji} ${priority}` },
          { type: 'mrkdwn', text: `*Status*\n${status}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Ticket ${shortId}  ·  Ticket Portal` }],
      },
    ],
  };
}

export async function sendTicketNotification({ ticket, creatorName, eventType = 'created' }) {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;

  if (eventType === 'created' && (await getSetting('slack_notify_on_create')) !== 'true') return;
  if (eventType === 'updated' && (await getSetting('slack_notify_on_update')) !== 'true') return;

  const title = eventType === 'created' ? '🎫 New Support Ticket' : '🔄 Ticket Updated';
  await post(webhookUrl, buildBlocks({ title, ticket, creatorName }));
}

export async function sendTestMessage() {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) throw new Error('Slack webhook URL is not configured.');

  await post(webhookUrl, {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Test Message', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Subject*\nTest ticket subject' },
          { type: 'mrkdwn', text: '*Submitted by*\nTest User' },
          { type: 'mrkdwn', text: '*Severity*\n🟡 Medium' },
          { type: 'mrkdwn', text: '*Status*\nOpen' },
        ],
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Slack integration is working correctly  ·  Ticket Portal' }],
      },
    ],
  });
}

export async function getSlackConfig() {
  const db = getDB();
  const rows = await db.query(
    `SELECT key, value FROM app_settings WHERE key IN ('slack_webhook_url','slack_notify_on_create','slack_notify_on_update')`
  );
  return Object.fromEntries(rows.rows.map(r => [r.key, r.value]));
}

export async function saveSlackConfig(updates) {
  const db = getDB();
  const allowed = ['slack_webhook_url', 'slack_notify_on_create', 'slack_notify_on_update'];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    await db.query(
      `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
      [value, key]
    );
  }
}
