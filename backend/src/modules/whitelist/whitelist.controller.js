import * as svc from './whitelist.service.js';

export async function getWhitelist(req, res) {
  try {
    res.json(await svc.listWhitelist());
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addToWhitelist(req, res) {
  try {
    const { type, value } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'type and value required' });
    if (!['email', 'domain'].includes(type)) return res.status(400).json({ error: 'type must be email or domain' });
    const entry = await svc.addEntry({ type, value, addedBy: req.user.id });
    if (!entry) return res.status(409).json({ error: 'Entry already exists' });
    res.status(201).json(entry);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function removeFromWhitelist(req, res) {
  try {
    await svc.removeEntry(req.params.id);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}
