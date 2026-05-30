import * as svc from './users.service.js';

export async function getUsers(req, res) {
  try {
    res.json(await svc.listUsers());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUser(req, res) {
  try {
    const user = await svc.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createUser(req, res) {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password required' });
    }
    const user = await svc.createUser({ email, name, password, role });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateUser(req, res) {
  try {
    const user = await svc.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await svc.deleteUser(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
