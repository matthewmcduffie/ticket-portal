import * as svc from './tickets.service.js';
import { logAudit } from '../audit/audit.service.js';

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
    if (req.user.role !== 'admin' && !(await svc.canAccessTicket(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    logAudit({ userId: req.user.id, userName: req.user.email, action: 'view_ticket', resourceType: 'ticket', resourceId: ticket.id, ip: req.ip });
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

export async function listAttachments(req, res) {
  try {
    if (req.user.role !== 'admin' && !(await svc.canAccessTicket(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { listAttachments: list } = await import('../attachments/attachments.service.js');
    res.json(await list(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function uploadAttachment(req, res) {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files received' });
    if (req.user.role !== 'admin' && !(await svc.canAccessTicket(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const config = req.uploadConfig;
    if (config) {
      const totalBytes = req.files.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > config.maxTotalSizeMb * 1024 * 1024) {
        const { unlink } = await import('fs');
        req.files.forEach(f => unlink(f.path, () => {}));
        return res.status(400).json({ error: `Total upload exceeds the ${config.maxTotalSizeMb} MB limit.` });
      }
    }

    const { saveAttachment } = await import('../attachments/attachments.service.js');
    const saved = [];
    for (const file of req.files) {
      saved.push(await saveAttachment({ ticketId: req.params.id, uploadedBy: req.user.id, file }));
    }
    res.status(201).json(saved);
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
    if (req.user.role !== 'admin' && !(await svc.canAccessTicket(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    logAudit({ userId: req.user.id, userName: req.user.email, action: 'view_thread', resourceType: 'ticket', resourceId: req.params.id, ip: req.ip });
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

// ── Sharing ────────────────────────────────────────────────
export async function getShares(req, res) {
  try {
    const ticket = await svc.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role !== 'admin' && !(await svc.canAccessTicket(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(await svc.getTicketShares(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addShare(req, res) {
  try {
    const ticket = await svc.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    // Only the ticket owner or admin can share
    if (req.user.role !== 'admin' && ticket.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the ticket owner can share it' });
    }
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (user_id === ticket.created_by) {
      return res.status(400).json({ error: 'Cannot share with the ticket owner' });
    }
    const share = await svc.shareTicket(req.params.id, user_id, req.user.id);
    res.status(201).json(share || { already: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function removeShare(req, res) {
  try {
    const ticket = await svc.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (req.user.role !== 'admin' && ticket.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the ticket owner can manage sharing' });
    }
    await svc.unshareTicket(req.params.id, req.params.userId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}
