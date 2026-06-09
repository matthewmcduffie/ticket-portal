import * as svc from './projects.service.js';
import { getUserById } from '../users/users.service.js';

async function membershipFor(req) {
  return svc.getMembership(req.params.id, req.user.id);
}

export async function listProjects(req, res) {
  try {
    res.json(await svc.listProjectsForUser(req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createProject(req, res) {
  try {
    const { name, summary, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });
    const project = await svc.createProject({
      name: name.trim(),
      summary: summary?.trim() || null,
      description: description?.trim() || null,
      ownerId: req.user.id,
    });
    res.status(201).json(project);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getProject(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const project = await svc.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ ...project, my_role: membership.role, members: await svc.getProjectMembers(project.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function updateProject(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can edit this project' });
    res.json(await svc.updateProject(req.params.id, req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deleteProject(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can delete this project' });
    await svc.deleteProject(req.params.id);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Membership ───────────────────────────────────────────────
export async function getMembers(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.getProjectMembers(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addMember(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can invite members' });

    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const target = await getUserById(user_id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!svc.canUseProjects(target)) {
      return res.status(400).json({ error: 'That user does not have project access enabled' });
    }

    const added = await svc.addMember(req.params.id, user_id, req.user.id);
    res.status(201).json(added || { already: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function removeMember(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });

    const { userId: targetId } = req.params;
    const isSelf = targetId === req.user.id;
    if (!isSelf && membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can remove members' });
    }

    const target = await svc.getMembership(req.params.id, targetId);
    if (target?.role === 'owner') {
      return res.status(400).json({ error: 'The project owner cannot be removed' });
    }

    await svc.removeMember(req.params.id, targetId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Project tickets ──────────────────────────────────────────
export async function listProjectTickets(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.listProjectTickets(req.params.id, {
      status: req.query.status,
      priority: req.query.priority,
      issueType: req.query.issue_type,
      labelId: req.query.label_id,
      milestoneId: req.query.milestone_id,
    }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createProjectTicket(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });

    const { title, description, priority, issue_type, due_date, milestone_id } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

    const ticket = await svc.createProjectTicket({
      projectId: req.params.id,
      title: title.trim(),
      description,
      priority,
      issueType: issue_type === 'bug' ? 'bug' : 'ticket',
      dueDate: due_date || null,
      milestoneId: milestone_id || null,
      createdBy: req.user.id,
    });
    res.status(201).json(ticket);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function ticketBelongsToProject(ticketId, projectId) {
  const ticket = await svc.getProjectTicketById(ticketId);
  return ticket && ticket.project_id === projectId ? ticket : null;
}

export async function getProjectTicket(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function updateProjectTicket(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const updated = await svc.updateProjectTicket(req.params.ticketId, req.body, req.user.id);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function getProjectTicketEvents(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(await svc.getProjectTicketEvents(req.params.ticketId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function addProjectTicketComment(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });
    const comment = await svc.addProjectTicketComment(req.params.ticketId, body, req.user.id);
    res.status(201).json(comment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Attachments ──────────────────────────────────────────────
export async function listProjectTicketAttachments(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(await svc.listProjectTicketAttachments(req.params.ticketId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function uploadProjectTicketAttachment(req, res) {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files received' });
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const config = req.uploadConfig;
    if (config) {
      const totalBytes = req.files.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > config.maxTotalSizeMb * 1024 * 1024) {
        const { unlink } = await import('fs');
        req.files.forEach(f => unlink(f.path, () => {}));
        return res.status(400).json({ error: `Total upload exceeds the ${config.maxTotalSizeMb} MB limit.` });
      }
    }

    const { saveProjectAttachment } = await import('../attachments/attachments.service.js');
    const saved = [];
    for (const file of req.files) {
      saved.push(await saveProjectAttachment({ projectTicketId: req.params.ticketId, uploadedBy: req.user.id, file }));
    }
    res.status(201).json(saved);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Invitations (accept / decline) ───────────────────────────
export async function getMyInvitations(req, res) {
  try {
    res.json(await svc.listPendingInvitations(req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function acceptInvitation(req, res) {
  try {
    const accepted = await svc.acceptInvitation(req.params.id, req.user.id);
    if (!accepted) return res.status(404).json({ error: 'Invitation not found' });
    res.json(accepted);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function declineInvitation(req, res) {
  try {
    const declined = await svc.declineInvitation(req.params.id, req.user.id);
    if (!declined) return res.status(404).json({ error: 'Invitation not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Polls ────────────────────────────────────────────────────
export async function listPolls(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.listPolls(req.params.id, req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createPoll(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });

    const { question, options } = req.body;
    const cleanOptions = Array.isArray(options) ? options.map(o => o?.trim()).filter(Boolean) : [];
    if (!question?.trim()) return res.status(400).json({ error: 'Poll question required' });
    if (cleanOptions.length < 2) return res.status(400).json({ error: 'Provide at least two options' });

    const poll = await svc.createPoll(req.params.id, { question: question.trim(), options: cleanOptions }, req.user.id);
    res.status(201).json(poll);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function pollBelongsToProject(pollId, projectId) {
  const poll = await svc.getPollById(pollId);
  return poll && poll.project_id === projectId ? poll : null;
}

export async function votePoll(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const poll = await pollBelongsToProject(req.params.pollId, req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.closed_at) return res.status(400).json({ error: 'This poll is closed' });

    const { option_id } = req.body;
    if (!option_id) return res.status(400).json({ error: 'option_id required' });

    await svc.votePoll(req.params.pollId, option_id, req.user.id);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function closePoll(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const poll = await pollBelongsToProject(req.params.pollId, req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (membership.role !== 'owner' && poll.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the poll creator or project owner can close this poll' });
    }
    await svc.closePoll(req.params.pollId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deletePoll(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const poll = await pollBelongsToProject(req.params.pollId, req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (membership.role !== 'owner' && poll.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the poll creator or project owner can delete this poll' });
    }
    await svc.deletePoll(req.params.pollId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Labels ───────────────────────────────────────────────────
export async function listLabels(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.listLabels(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createLabel(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can manage labels' });

    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Label name required' });

    const label = await svc.createLabel(req.params.id, { name: name.trim(), color });
    if (!label) return res.status(409).json({ error: 'A label with that name already exists' });
    res.status(201).json(label);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deleteLabel(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can manage labels' });

    const label = await svc.getLabelById(req.params.labelId);
    if (!label || label.project_id !== req.params.id) return res.status(404).json({ error: 'Label not found' });

    await svc.deleteLabel(req.params.labelId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function setTicketLabels(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    const ticket = await ticketBelongsToProject(req.params.ticketId, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { label_ids } = req.body;
    if (!Array.isArray(label_ids)) return res.status(400).json({ error: 'label_ids array required' });

    await svc.setTicketLabels(req.params.ticketId, label_ids);
    res.json(await svc.getTicketLabels(req.params.ticketId));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Milestones ───────────────────────────────────────────────
export async function listMilestones(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.listMilestones(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function createMilestone(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can manage milestones' });

    const { name, description, target_date } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Milestone name required' });

    const milestone = await svc.createMilestone(req.params.id, { name: name.trim(), description, target_date });
    res.status(201).json(milestone);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function milestoneBelongsToProject(milestoneId, projectId) {
  const m = await svc.getMilestoneById(milestoneId);
  return m && m.project_id === projectId ? m : null;
}

export async function updateMilestone(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can manage milestones' });
    const milestone = await milestoneBelongsToProject(req.params.milestoneId, req.params.id);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    res.json(await svc.updateMilestone(req.params.milestoneId, req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

export async function deleteMilestone(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the project owner can manage milestones' });
    const milestone = await milestoneBelongsToProject(req.params.milestoneId, req.params.id);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    await svc.deleteMilestone(req.params.milestoneId);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// ── Activity feed ────────────────────────────────────────────
export async function getProjectActivity(req, res) {
  try {
    const membership = await membershipFor(req);
    if (!membership) return res.status(404).json({ error: 'Project not found' });
    res.json(await svc.getProjectActivity(req.params.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}
