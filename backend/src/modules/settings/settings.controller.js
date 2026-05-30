import * as svc from './settings.service.js';

export async function getSettings(req, res) {
  try {
    res.json(await svc.getAllSettings());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSetting(req, res) {
  try {
    const { value } = req.body;
    const setting = await svc.updateSetting(req.params.key, value);
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json(setting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
