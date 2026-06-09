import * as svc from './equipment.service.js';
import { logAudit } from '../audit/audit.service.js';

export async function listRequests(req, res) {
  try {
    res.json(await svc.listRequests());
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createRequest(req, res) {
  try {
    const { hire_name, hire_department, hire_start_date, requestor_name, items, due_date, notes } = req.body;
    if (!hire_name?.trim() || !hire_department?.trim() || !hire_start_date || !requestor_name?.trim() || !due_date) {
      return res.status(400).json({ error: 'hire_name, hire_department, hire_start_date, requestor_name, and due_date are required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item must be selected' });
    }
    const request = await svc.createRequest({
      hireName: hire_name.trim(),
      hireDepartment: hire_department.trim(),
      hireStartDate: hire_start_date,
      requestorName: requestor_name.trim(),
      items,
      dueDate: due_date,
      notes: notes || null,
      createdBy: req.user.id,
      createdByName: req.user.email,
    });
    logAudit({ userId: req.user.id, userName: req.user.email, action: 'create_equipment_request', resourceType: 'equipment_request', resourceId: request.id, ip: req.ip });

    import('../discord/discord.service.js')
      .then(({ sendEquipmentNotification }) => sendEquipmentNotification({ request }))
      .catch(err => console.error('Discord equipment notification failed:', err.message));

    import('../slack/slack.service.js')
      .then(({ sendEquipmentNotification }) => sendEquipmentNotification({ request }))
      .catch(err => console.error('Slack equipment notification failed:', err.message));

    res.status(201).json(request);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getRequest(req, res) {
  try {
    const request = await svc.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    const events = await svc.getEvents(req.params.id);
    res.json({ ...request, events });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function updateRequest(req, res) {
  try {
    const request = await svc.updateRequest(req.params.id, req.body, {
      userId: req.user.id,
      userName: req.user.email,
    });
    if (!request) return res.status(404).json({ error: 'Not found' });
    res.json(request);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deleteRequest(req, res) {
  try {
    const request = await svc.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    await svc.deleteRequest(req.params.id);
    logAudit({ userId: req.user.id, userName: req.user.email, action: 'delete_equipment_request', resourceType: 'equipment_request', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addComment(req, res) {
  try {
    const { detail } = req.body;
    if (!detail?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
    await svc.addComment(req.params.id, {
      userId: req.user.id,
      userName: req.user.email,
      detail: detail.trim(),
    });
    res.status(201).json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}
