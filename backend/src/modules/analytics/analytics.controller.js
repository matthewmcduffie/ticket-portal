import { getOverview } from './analytics.service.js';

export async function overview(req, res) {
  try {
    res.json(await getOverview());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
