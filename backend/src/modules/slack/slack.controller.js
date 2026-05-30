import { sendTestMessage, getSlackConfig, saveSlackConfig } from './slack.service.js';

export async function testSlack(req, res) {
  try {
    await sendTestMessage();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function getConfig(req, res) {
  try {
    res.json(await getSlackConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateConfig(req, res) {
  try {
    await saveSlackConfig(req.body);
    res.json(await getSlackConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
