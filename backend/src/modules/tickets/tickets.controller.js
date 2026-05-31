import * as svc from './tickets.service.js';

export async function getTickets(req, res) {
  try {
    res.json(await svc.listTickets({
      userId: req.user.id, role: req.user.role,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      priority: req.query.priority,
    }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getTicket(req, res) {
  try {
    const ticket = await svc.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createTicket(req, res) {
  try {
    const { title, description, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    res.status(201).json(await svc.createTicket({ title, description, priority, createdBy: req.user.id }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function updateTicket(req, res) {
  try {
    const ticket = await svc.updateTicket(req.params.id, req.body, req.user.role, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found or unauthorized' });
    res.json(ticket);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deleteTicket(req, res) {
  try {
    await svc.deleteTicket(req.params.id);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getTicketEvents(req, res) {
  try {
    res.json(await svc.getTicketEvents(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getRecentActivity(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    res.json(await svc.getRecentActivity(limit));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addComment(req, res) {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });
    const event = await svc.addComment(req.params.id, body, req.user.id, req.user.role);
    if (!event) return res.status(404).json({ error: 'Ticket not found or unauthorized' });
    res.status(201).json(event);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function mergeTickets(req, res) {
  try {
    const { ticket_ids } = req.body;
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ error: 'ticket_ids array required' });
    }
    const result = await svc.mergeTickets(req.params.id, ticket_ids, req.user.id);
    if (!result) return res.status(404).json({ error: 'Primary ticket not found' });
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}
