import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ProjectTicketModal from './ProjectTicketModal.jsx';
import './Projects.css';

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };

function initials(name) { return name?.charAt(0).toUpperCase() || '?'; }

function MembersSection({ project, isOwner, currentUserId, onChanged }) {
  const [allUsers, setAllUsers] = useState([]);
  const [inviteId, setInviteId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isOwner) return;
    api.get('/users').then(r => setAllUsers(r.data)).catch(() => {});
  }, [isOwner]);

  const memberIds = new Set(project.members.map(m => m.id));
  const invitable = allUsers.filter(u =>
    !memberIds.has(u.id) && (u.role === 'admin' || u.can_use_projects)
  );

  async function handleInvite() {
    if (!inviteId) return;
    setInviting(true);
    setMsg('');
    try {
      await api.post(`/projects/${project.id}/members`, { user_id: inviteId });
      setInviteId('');
      onChanged();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to invite user');
    } finally { setInviting(false); }
  }

  async function handleRemove(userId) {
    try {
      await api.delete(`/projects/${project.id}/members/${userId}`);
      onChanged();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to remove member');
    }
  }

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">group</span>
          Members
          <span className="badge">{project.members.length}</span>
        </div>
      </div>

      <div className="member-list">
        {project.members.map(m => (
          <div key={m.id} className="member-row">
            <div className="member-row__avatar">{initials(m.name)}</div>
            <div className="member-row__info">
              <div className="member-row__name">{m.name}</div>
              <div className="member-row__email">{m.email}</div>
            </div>
            <span className="badge member-row__role">{m.role === 'owner' ? 'Owner' : 'Member'}</span>
            {(isOwner && m.role !== 'owner') || (m.id === currentUserId && m.role !== 'owner') ? (
              <button
                className="btn btn--ghost btn--sm"
                title={m.id === currentUserId ? 'Leave project' : 'Remove member'}
                onClick={() => handleRemove(m.id)}
              >
                <span className="material-symbols-outlined">{m.id === currentUserId ? 'logout' : 'person_remove'}</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {isOwner && (
        <div>
          {msg && <p className="member-invite__msg">{msg}</p>}
          {invitable.length > 0 ? (
            <div className="member-invite">
              <select className="form-select member-invite__select" value={inviteId} onChange={e => setInviteId(e.target.value)}>
                <option value="">Invite a teammate…</option>
                {invitable.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <button className="btn btn--primary btn--sm" disabled={!inviteId || inviting} onClick={handleInvite}>
                {inviting ? '…' : 'Invite'}
              </button>
            </div>
          ) : (
            <p className="proj-empty">No other users with Projects access available to invite.</p>
          )}
        </div>
      )}
    </div>
  );
}

const BOARD_COLUMNS = [
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'closed',      label: 'Closed' },
];

function TicketCard({ t, onClick }) {
  return (
    <button className="proj-ticket-row" onClick={onClick}>
      <div className="proj-ticket-row__main">
        <span className="proj-ticket-row__title">{t.title}</span>
        <span className="proj-ticket-row__meta">
          {t.creator_name}{t.assignee_name ? ` · assigned to ${t.assignee_name}` : ''} · {new Date(t.created_at).toLocaleDateString()}
          {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ''}
          {t.milestone_name ? ` · ${t.milestone_name}` : ''}
        </span>
        {t.labels?.length > 0 && (
          <div className="label-picker" style={{ marginTop: 4 }}>
            {t.labels.map(l => (
              <span key={l.id} className="label-chip label-chip--static" style={{ '--label-color': l.color }}>{l.name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="proj-ticket-row__badges">
        <span className={`badge badge--status badge--${t.status}`}>{STATUS_LABEL[t.status]}</span>
        <span className={`badge badge--${t.priority}`}>{t.priority}</span>
        <span className="badge">{t.issue_type === 'bug' ? 'Bug' : 'Ticket'}</span>
      </div>
    </button>
  );
}

function TicketsSection({ projectId }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [issueType, setIssueType] = useState('');
  const [labelId, setLabelId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState('list');
  const [labels, setLabels] = useState([]);
  const [milestones, setMilestones] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (issueType) params.set('issue_type', issueType);
    if (labelId) params.set('label_id', labelId);
    if (milestoneId) params.set('milestone_id', milestoneId);
    api.get(`/projects/${projectId}/tickets?${params}`)
      .then(r => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, status, issueType, labelId, milestoneId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get(`/projects/${projectId}/labels`).then(r => setLabels(r.data)).catch(() => {});
    api.get(`/projects/${projectId}/milestones`).then(r => setMilestones(r.data)).catch(() => {});
  }, [projectId]);

  function onSaved() {
    setShowNew(false);
    setSelected(null);
    load();
  }

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">checklist</span>
          Tickets &amp; Bugs
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <div className="view-toggle">
            <button className={`view-toggle__btn${view === 'list' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => setView('list')} title="List view">
              <span className="material-symbols-outlined">view_list</span>
            </button>
            <button className={`view-toggle__btn${view === 'board' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => setView('board')} title="Board view">
              <span className="material-symbols-outlined">view_kanban</span>
            </button>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined">add</span>
            New
          </button>
        </div>
      </div>

      <div className="proj-filter-bar">
        <select className="form-select" value={issueType} onChange={e => setIssueType(e.target.value)}>
          <option value="">All types</option>
          <option value="ticket">Tickets</option>
          <option value="bug">Bugs</option>
        </select>
        {view === 'list' && (
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        )}
        {labels.length > 0 && (
          <select className="form-select" value={labelId} onChange={e => setLabelId(e.target.value)}>
            <option value="">All labels</option>
            {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {milestones.length > 0 && (
          <select className="form-select" value={milestoneId} onChange={e => setMilestoneId(e.target.value)}>
            <option value="">All milestones</option>
            {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="proj-empty">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="proj-empty">Nothing here yet. Create the first ticket or bug for this project.</div>
      ) : view === 'board' ? (
        <div className="kanban-board">
          {BOARD_COLUMNS.map(col => (
            <div key={col.key} className="kanban-column">
              <div className="kanban-column__header">
                {col.label}
                <span className="badge">{tickets.filter(t => t.status === col.key).length}</span>
              </div>
              <div className="kanban-column__list">
                {tickets.filter(t => t.status === col.key).map(t => (
                  <TicketCard key={t.id} t={t} onClick={() => setSelected(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="proj-ticket-list">
          {tickets.map(t => (
            <TicketCard key={t.id} t={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      {(showNew || selected) && (
        <ProjectTicketModal
          projectId={projectId}
          ticket={selected}
          onClose={() => { setShowNew(false); setSelected(null); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function LabelsSection({ projectId, isOwner }) {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6d28d9');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/labels`)
      .then(r => setLabels(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setMsg('');
    try {
      await api.post(`/projects/${projectId}/labels`, { name: name.trim(), color });
      setName('');
      setColor('#6d28d9');
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create label');
    } finally { setCreating(false); }
  }

  async function handleDelete(labelId) {
    try {
      await api.delete(`/projects/${projectId}/labels/${labelId}`);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to delete label');
    }
  }

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">sell</span>
          Labels
        </div>
      </div>

      {loading ? (
        <div className="proj-empty">Loading…</div>
      ) : labels.length === 0 ? (
        <div className="proj-empty">No labels yet.</div>
      ) : (
        <div className="label-picker">
          {labels.map(l => (
            <span key={l.id} className="label-chip label-chip--static" style={{ '--label-color': l.color }}>
              {l.name}
              {isOwner && (
                <button type="button" className="label-chip__remove" onClick={() => handleDelete(l.id)} title="Delete label">
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {isOwner && (
        <form className="label-create-form" onSubmit={handleCreate}>
          {msg && <p className="member-invite__msg">{msg}</p>}
          <input className="form-input" placeholder="Label name" value={name}
            onChange={e => setName(e.target.value)} maxLength={40} style={{ flex: 1 }} />
          <input type="color" className="label-color-input" value={color} onChange={e => setColor(e.target.value)} title="Label color" />
          <button className="btn btn--primary btn--sm" disabled={!name.trim() || creating}>
            {creating ? '…' : 'Add label'}
          </button>
        </form>
      )}
    </div>
  );
}

function MilestonesSection({ projectId, isOwner }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', target_date: '' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/milestones`)
      .then(r => setMilestones(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setMsg('');
    try {
      await api.post(`/projects/${projectId}/milestones`, form);
      setForm({ name: '', description: '', target_date: '' });
      setShowNew(false);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create milestone');
    } finally { setCreating(false); }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/projects/${projectId}/milestones/${id}`);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to delete milestone');
    }
  }

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">flag</span>
          Milestones
        </div>
        {isOwner && (
          <button className="btn btn--ghost btn--sm" onClick={() => setShowNew(s => !s)}>
            <span className="material-symbols-outlined">add</span>
            New milestone
          </button>
        )}
      </div>

      {msg && <p className="member-invite__msg">{msg}</p>}

      {showNew && (
        <form className="milestone-form" onSubmit={handleCreate}>
          <div className="form-field">
            <label className="form-label" htmlFor="ms-name">Name</label>
            <input id="ms-name" className="form-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="modal__form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ms-target">Target date</label>
              <input id="ms-target" type="date" className="form-input" value={form.target_date}
                onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="ms-desc">Description</label>
            <textarea id="ms-desc" className="form-textarea" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="modal__form-actions">
            <button className="btn btn--primary btn--sm" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="proj-empty">Loading…</div>
      ) : milestones.length === 0 ? (
        <div className="proj-empty">No milestones yet.</div>
      ) : (
        <div className="milestone-list">
          {milestones.map(m => {
            const pct = m.ticket_count > 0 ? Math.round((m.closed_count / m.ticket_count) * 100) : 0;
            return (
              <div key={m.id} className="milestone-row">
                <div className="milestone-row__top">
                  <span className="milestone-row__name">{m.name}</span>
                  {m.target_date && <span className="milestone-row__date">Target: {new Date(m.target_date).toLocaleDateString()}</span>}
                  {isOwner && (
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDelete(m.id)} title="Delete milestone">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
                {m.description && <p className="milestone-row__desc">{m.description}</p>}
                <div className="milestone-row__progress">
                  <div className="milestone-progress-bar">
                    <div className="milestone-progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="milestone-row__progress-label">{m.closed_count}/{m.ticket_count} closed ({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PollsSection({ projectId, currentUserId, isOwner }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/polls`)
      .then(r => setPolls(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function updateOption(i, value) {
    setOptions(opts => opts.map((o, idx) => idx === i ? value : o));
  }
  function addOption() { setOptions(opts => [...opts, '']); }
  function removeOption(i) { setOptions(opts => opts.filter((_, idx) => idx !== i)); }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setMsg('');
    try {
      await api.post(`/projects/${projectId}/polls`, { question, options });
      setQuestion('');
      setOptions(['', '']);
      setShowNew(false);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create poll');
    } finally { setCreating(false); }
  }

  async function vote(pollId, optionId) {
    try {
      await api.post(`/projects/${projectId}/polls/${pollId}/vote`, { option_id: optionId });
      load();
    } catch { /* ignore */ }
  }

  async function close(pollId) {
    try { await api.post(`/projects/${projectId}/polls/${pollId}/close`); load(); }
    catch { /* ignore */ }
  }

  async function remove(pollId) {
    try { await api.delete(`/projects/${projectId}/polls/${pollId}`); load(); }
    catch { /* ignore */ }
  }

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">poll</span>
          Polls
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => setShowNew(s => !s)}>
          <span className="material-symbols-outlined">add</span>
          New poll
        </button>
      </div>

      {msg && <p className="member-invite__msg">{msg}</p>}

      {showNew && (
        <form className="poll-form" onSubmit={handleCreate}>
          <div className="form-field">
            <label className="form-label" htmlFor="poll-q">Question</label>
            <input id="poll-q" className="form-input" value={question}
              onChange={e => setQuestion(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Options</label>
            {options.map((o, i) => (
              <div key={i} className="poll-option-input">
                <input className="form-input" value={o} placeholder={`Option ${i + 1}`}
                  onChange={e => updateOption(i, e.target.value)} />
                {options.length > 2 && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeOption(i)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={addOption}>
              <span className="material-symbols-outlined">add</span> Add option
            </button>
          </div>
          <div className="modal__form-actions">
            <button className="btn btn--primary btn--sm" disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="proj-empty">Loading…</div>
      ) : polls.length === 0 ? (
        <div className="proj-empty">No polls yet.</div>
      ) : (
        <div className="poll-list">
          {polls.map(p => (
            <div key={p.id} className="poll-card">
              <div className="poll-card__top">
                <span className="poll-card__question">{p.question}</span>
                {p.closed_at ? (
                  <span className="badge">Closed</span>
                ) : (
                  (isOwner || p.created_by === currentUserId) && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => close(p.id)}>Close</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => remove(p.id)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  )
                )}
              </div>
              <div className="poll-card__options">
                {p.options.map(o => {
                  const pct = p.total_votes > 0 ? Math.round((o.vote_count / p.total_votes) * 100) : 0;
                  const mine = p.my_vote === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`poll-option${mine ? ' poll-option--mine' : ''}`}
                      disabled={!!p.closed_at}
                      onClick={() => vote(p.id, o.id)}
                    >
                      <div className="poll-option__bar" style={{ width: `${pct}%` }} />
                      <span className="poll-option__label">
                        {mine && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>}
                        {o.text}
                      </span>
                      <span className="poll-option__pct">{pct}% ({o.vote_count})</span>
                    </button>
                  );
                })}
              </div>
              <div className="poll-card__meta">{p.total_votes} vote{p.total_votes !== 1 ? 's' : ''} · by {p.creator_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTIVITY_ICONS = {
  created:          'confirmation_number',
  status_changed:   'swap_horiz',
  priority_changed: 'flag',
  assigned:         'person',
  comment:          'chat',
  attachment:       'attach_file',
};

function ActivitySection({ projectId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${projectId}/activity`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="project-section">
      <div className="project-section__header">
        <div className="project-section__title">
          <span className="material-symbols-outlined">history</span>
          Activity Feed
        </div>
      </div>
      {loading ? (
        <div className="proj-empty">Loading…</div>
      ) : events.length === 0 ? (
        <div className="proj-empty">No activity yet.</div>
      ) : (
        <div className="activity-list">
          {events.map(ev => (
            <div key={ev.id} className="activity-row">
              <span className="material-symbols-outlined activity-row__icon">{ACTIVITY_ICONS[ev.event_type] || 'info'}</span>
              <div className="activity-row__main">
                <span className="activity-row__text">
                  <strong>{ev.user_name}</strong> {ev.detail} on <em>{ev.ticket_title}</em>
                </span>
                <span className="activity-row__time">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', summary: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/projects/${id}`)
      .then(r => {
        setProject(r.data);
        setEditForm({ name: r.data.name, summary: r.data.summary || '', description: r.data.description || '' });
        setErr('');
      })
      .catch(e => setErr(e.response?.data?.error || 'Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = project?.my_role === 'owner';

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${id}`, editForm);
      setEditing(false);
      load();
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to save changes');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.delete(`/projects/${id}`);
      navigate('/projects');
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to delete project');
    }
  }

  if (loading) return <div className="project-page"><div className="proj-empty">Loading project…</div></div>;
  if (err || !project) return <div className="project-page"><div className="modal__error" role="alert">{err || 'Project not found'}</div></div>;

  return (
    <div className="project-page">
      <div className="project-summary">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="proj-modal__body" style={{ padding: 0 }}>
            <div className="form-field">
              <label className="form-label" htmlFor="ep-name">Name</label>
              <input id="ep-name" className="form-input" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ep-summary">Brief summary</label>
              <input id="ep-summary" className="form-input" maxLength={200} value={editForm.summary}
                onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ep-description">Description</label>
              <textarea id="ep-description" className="form-textarea" rows={4} value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="modal__form-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className="project-summary__top">
              <div>
                <div className="project-summary__name">{project.name}</div>
                {project.summary && <p className="project-summary__desc">{project.summary}</p>}
              </div>
              {isOwner && (
                <div className="project-summary__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                    <span className="material-symbols-outlined">edit</span> Edit
                  </button>
                  {!confirmDelete ? (
                    <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(true)}>
                      <span className="material-symbols-outlined">delete</span> Delete
                    </button>
                  ) : (
                    <>
                      <button className="btn btn--danger btn--sm" onClick={handleDelete}>Confirm delete</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </>
                  )}
                </div>
              )}
            </div>
            {project.description && <p className="project-summary__desc">{project.description}</p>}
          </>
        )}
      </div>

      <MembersSection project={project} isOwner={isOwner} currentUserId={user?.id} onChanged={load} />
      <TicketsSection projectId={project.id} />
      <LabelsSection projectId={project.id} isOwner={isOwner} />
      <MilestonesSection projectId={project.id} isOwner={isOwner} />
      <PollsSection projectId={project.id} currentUserId={user?.id} isOwner={isOwner} />
      <ActivitySection projectId={project.id} />
    </div>
  );
}
