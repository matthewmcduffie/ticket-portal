import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api.js';
import './Projects.css';

function initials(name) {
  return name?.charAt(0).toUpperCase() || '?';
}

function MemberStack({ members, max = 4 }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="proj-members">
      {shown.map(m => (
        <div key={m.id} className="proj-members__avatar" title={m.name}>{initials(m.name)}</div>
      ))}
      {extra > 0 && <div className="proj-members__avatar proj-members__avatar--more">+{extra}</div>}
    </div>
  );
}

function ProjectCard({ project, onOpen }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="proj-card"
      onClick={() => onOpen(project)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="button"
      tabIndex={0}
    >
      <div className="proj-card__header">
        <div className="proj-card__icon">
          <span className="material-symbols-outlined">folder_special</span>
        </div>
        <div className="proj-card__title-wrap">
          <div className="proj-card__title">{project.name}</div>
          {project.my_role === 'owner' && <span className="badge proj-card__owner-badge">Owner</span>}
        </div>
      </div>
      <p className="proj-card__summary">{project.summary || 'No summary provided.'}</p>
      <div className="proj-card__footer">
        <MemberStack members={project.members} />
        <span className="proj-card__member-count">
          {project.members.length} member{project.members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {hover && (
        <div className="proj-card__tooltip">
          <div className="proj-card__tooltip-name">{project.name}</div>
          <div className="proj-card__tooltip-summary">{project.summary || 'No summary provided.'}</div>
          <div className="proj-card__tooltip-members-label">Members</div>
          <ul className="proj-card__tooltip-members">
            {project.members.map(m => (
              <li key={m.id}>
                {m.name}
                {m.role === 'owner' && <span className="proj-card__tooltip-owner"> · owner</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InvitationsBanner({ onResolved }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    api.get('/projects/invitations')
      .then(r => setInvites(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(projectId, action) {
    setBusyId(projectId);
    try {
      await api.post(`/projects/invitations/${projectId}/${action}`);
      setInvites(prev => prev.filter(p => p.id !== projectId));
      onResolved?.();
    } catch { /* ignore */ }
    finally { setBusyId(null); }
  }

  if (loading || invites.length === 0) return null;

  return (
    <div className="invite-banner">
      <span className="material-symbols-outlined invite-banner__icon">mail</span>
      <div className="invite-banner__list">
        {invites.map(p => (
          <div key={p.id} className="invite-banner__row">
            <span className="invite-banner__text">
              <strong>{p.invited_by_name}</strong> invited you to join <strong>{p.project_name}</strong>
            </span>
            <div className="invite-banner__actions">
              <button className="btn btn--primary btn--sm" disabled={busyId === p.id}
                onClick={() => respond(p.id, 'accept')}>Accept</button>
              <button className="btn btn--ghost btn--sm" disabled={busyId === p.id}
                onClick={() => respond(p.id, 'decline')}>Decline</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', summary: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Project name is required.'); return; }
    setErr('');
    setSaving(true);
    try {
      const { data } = await api.post('/projects', form);
      onCreated(data);
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="proj-modal" role="dialog" aria-modal="true">
        <div className="proj-modal__header">
          <h2 className="proj-modal__title">New Project</h2>
          <button className="proj-modal__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form className="proj-modal__body" onSubmit={handleSubmit}>
          {err && <div className="modal__error" role="alert">{err}</div>}
          <div className="form-field">
            <label className="form-label" htmlFor="proj-name">Name</label>
            <input id="proj-name" name="name" className="form-input" value={form.name} onChange={handleChange} required autoFocus />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="proj-summary">Brief summary</label>
            <input id="proj-summary" name="summary" className="form-input" maxLength={200}
              placeholder="A short line shown on the project card" value={form.summary} onChange={handleChange} />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="proj-description">Description</label>
            <textarea id="proj-description" name="description" className="form-textarea" rows={4}
              placeholder="What is this project for? (optional)" value={form.description} onChange={handleChange} />
          </div>
          <div className="modal__form-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/projects')
      .then(r => { setProjects(r.data); setErr(''); })
      .catch(e => setErr(e.response?.data?.error || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowNew(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  function onCreated(project) {
    setShowNew(false);
    navigate(`/projects/${project.id}`);
  }

  return (
    <div className="projects-page">
      <InvitationsBanner onResolved={load} />
      <div className="projects-page__toolbar">
        <p className="projects-page__hint">
          Projects are your own space to collect feedback and track work with the people you invite.
          You'll only see projects you own or have been invited to.
        </p>
        <button className="btn btn--primary" onClick={() => setShowNew(true)}>
          <span className="material-symbols-outlined">add</span>
          New Project
        </button>
      </div>

      {err && <div className="modal__error" role="alert">{err}</div>}

      {loading ? (
        <div className="projects-page__empty">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="projects-page__empty">
          <span className="material-symbols-outlined projects-page__empty-icon">folder_special</span>
          <p>You don't have any projects yet.</p>
          <p className="projects-page__empty-sub">Create one, or ask a teammate to invite you to theirs.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={proj => navigate(`/projects/${proj.id}`)} />
          ))}
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={onCreated} />}
    </div>
  );
}
