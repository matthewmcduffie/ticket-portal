import * as svc from './tickets.service.js';

export async function getTickets(req, res) {
  try {
    const { page, limit, status, priority } = req.query;
    const tickets = await svc.listTickets({
      userId: req.user.id,
      role: req.user.role,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      priority,
    });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getTicket(req, res) {
  try {
    const ticket = await svc.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createTicket(req, res) {
  try {
    const { title, description, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const ticket = await svc.createTicket({ title, description, priority, createdBy: req.user.id });
    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTicket(req, res) {
  try {
    const ticket = await svc.updateTicket(req.params.id, req.body, req.user.role, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found or unauthorized' });
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTicket(req, res) {
  try {
    await svc.deleteTicket(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
