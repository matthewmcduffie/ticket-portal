import { pollInbox, processIncomingMessage, getInboxInfo, registerWebhook, sendEmail } from './email.service.js';

export async function handleWebhook(req, res) {
  // Acknowledge immediately so AgentMail doesn't retry
  res.status(200).json({ ok: true });

  try {
    const { event_type, payload } = req.body;
    if (event_type === 'message.received' && payload) {
      await processIncomingMessage(payload);
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
}

export async function triggerPoll(req, res) {
  try {
    const tickets = await pollInbox();
    res.json({ processed: tickets.length, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStatus(req, res) {
  try {
    const inbox = await getInboxInfo();
    res.json({ inbox });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function testEmail(req, res) {
  try {
    const to = req.user.email;
    await sendEmail({
      to,
      subject: '[Ticket Portal] Test Email',
      text: 'Your email integration is working correctly.\n\nThis is a test message from Ticket Portal.',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;background:#f7f9fb;"><div style="max-width:580px;margin:32px auto;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;"><div style="background:#1a3461;padding:18px 24px;"><h1 style="color:#fff;margin:0;font-size:17px;">Ticket Portal</h1></div><div style="background:#fff;padding:28px 24px;"><h2 style="margin:0 0 12px;color:#191c1e;">✅ Email integration is working</h2><p style="font-size:14px;color:#45464d;">This test message confirms that outbound email delivery is configured correctly.</p></div></div></body></html>`,
    });
    res.json({ success: true, sentTo: to });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function setupWebhook(req, res) {
  try {
    const appDomain = process.env.APP_DOMAIN;
    if (!appDomain) return res.status(400).json({ error: 'APP_DOMAIN not set in .env' });
    const url = `https://${appDomain}/api/email/webhook`;
    const result = await registerWebhook(url);
    res.json({ ok: true, webhook: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
