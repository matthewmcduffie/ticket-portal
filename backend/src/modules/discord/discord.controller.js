import { sendTestMessage, getDiscordConfig, saveDiscordConfig } from './discord.service.js';

export async function testDiscord(req, res) {
  try {
    await sendTestMessage();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function getConfig(req, res) {
  try {
    res.json(await getDiscordConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateConfig(req, res) {
  try {
    await saveDiscordConfig(req.body);
    res.json(await getDiscordConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
