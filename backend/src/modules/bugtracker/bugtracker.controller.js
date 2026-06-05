import * as svc from './bugtracker.service.js';

export async function getSoftware(req, res) {
  try {
    res.json(await svc.listSoftware());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function addSoftware(req, res) {
  try {
    const { name, url } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Software name required' });
    res.status(201).json(await svc.createSoftware({ name, url }));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Software already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function removeSoftware(req, res) {
  try {
    await svc.deleteSoftware(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
