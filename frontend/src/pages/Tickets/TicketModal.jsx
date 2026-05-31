import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './TicketModal.css';

const NEEDS_RESOLUTION_NOTE = ['resolved', 'closed'];

export default function TicketModal({ ticket, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit  = !!ticket;
  const isAdmin = user?.role === 'admin';
  const threadRef = useRef(null);

  // ── Ticket form ──────────────────────────────────────────
  const [form, setForm] = useState({
    title:       ticket?.title       ?? '',
    description: ticket?.description ?? '',
    priority:    ticket?.priority    ?? 'medium',
    status:      ticket?.status      ?? 'open',
  });
  const [resolutionNote, setResolutionNote] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');

  const statusChanged     = isEdit && form.status !== ticket?.status;
  const needsResNote      = statusChanged && NEEDS_RESOLUTION_NOTE.includes(form.status);

  // ── Thread ───────────────────────────────────────────────
  const [events,   setEvents]   = useState([]);
  const [evtLoad,  setEvtLoad]  = useState(true);

  // ── Response input ───────────────────────────────────────
  const [reply,    setReply]    = useState('');
  const [posting,  setPosting]  = useState(false);
  const [replyErr, setReplyErr] = useState('');

  // ── Merge ────────────────────────────────────────────────
  const [mergeOpen,   setMergeOpen]   = useState(false);
  const [allTickets,  setAllTickets]  = useState([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [merging,     setMerging]     = useState(false);
  const [mergeMsg,    setMergeMsg]    = useState('');

  function loadEvents() {
    if (!isEdit) return;
    api.get(`/tickets/${ticket.id}/events`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setEvtLoad(false));
  }

  useEffect(() => {
    loadEvents();
  }, [ticket?.id]);

  // Scroll thread to bottom when events load
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (mergeOpen && isAdmin && isEdit) {
      api.get('/tickets?limit=200').then(r => {
        setAllTickets(r.data.filter(t => t.id !== ticket.id && t.status !== 'closed'));
      }).catch(console.error);
    }
  }, [mergeOpen]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'status') setResolutionNote('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormErr('');
    if (needsResNote && !resolutionNote.trim()) {
      setFormErr('A resolution note is required when closing or resolving a ticket.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/tickets/${ticket.id}`, form);
        // Post resolution note as a comment
        if (needsResNote && resolutionNote.trim()) {
          await api.post(`/tickets/${ticket.id}/comments`, {
            body: `[Resolution] ${resolutionNote.trim()}`,
          });
        }
      } else {
        await api.post('/tickets', form);
      }
      onSaved();
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setReplyErr('');
    setPosting(true);
    try {
      await api.post(`/tickets/${ticket.id}/comments`, { body: reply.trim() });
      setReply('');
      loadEvents();
    } catch (err) {
      setReplyErr(err.response?.data?.error || 'Failed to post response');
    } finally {
      setPosting(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function handleMerge() {
    if (!selectedIds.length) return;
    setMerging(true);
    setMergeMsg('');
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/merge`, { ticket_ids: selectedIds });
      setMergeMsg(`Merged ${data.merged.length} ticket${data.merged.length !== 1 ? 's' : ''}.`);
      setSelectedIds([]);
      setAllTickets(p => p.filter(t => !selectedIds.includes(t.id)));
      loadEvents();
    } catch (err) {
      setMergeMsg(err.response?.data?.error || 'Merge failed.');
    } finally {
      setMerging(false);
    }
  }

  const filteredForMerge = allTickets.filter(t => {
    const q = mergeSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.creator_name?.toLowerCase().includes(q);
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="modal__header">
          <div className="modal__header-left">
            {isEdit && <span className="modal__ticket-id">#{ticket.id.slice(0, 6).toUpperCase()}</span>}
            <h2 className="modal__title">{isEdit ? (form.title || 'Ticket') : 'New Ticket'}</h2>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="modal__body" ref={threadRef}>

          {/* Details form */}
          <form className="modal__form" onSubmit={handleSave} id="ticket-form">
            {formErr && <div className="modal__error" role="alert">{formErr}</div>}

            <div className="form-field">
              <label className="form-label" htmlFor="modal-title">Title</label>
              <input id="modal-title" name="title" className="form-input"
                value={form.title} onChange={handleChange} required autoFocus={!isEdit} />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="modal-desc">Description</label>
              <textarea id="modal-desc" name="description" className="form-textarea"
                rows={3} value={form.description} onChange={handleChange} />
            </div>

            <div className="modal__form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="modal-priority">Priority</label>
                <select id="modal-priority" name="priority" className="form-select"
                  value={form.priority} onChange={handleChange}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              {isEdit && (
                <div className="form-field">
                  <label className="form-label" htmlFor="modal-status">Status</label>
                  <select id="modal-status" name="status" className="form-select"
                    value={form.status} onChange={handleChange}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )}
            </div>

            {/* Resolution note — required when closing/resolving */}
            {needsResNote && (
              <div className="form-field modal__resolution">
                <label className="form-label" htmlFor="modal-res-note">
                  <span className="material-symbols-outlined modal__res-icon">task_alt</span>
                  Resolution note <span className="modal__required">required</span>
                </label>
                <textarea
                  id="modal-res-note"
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe what was done to resolve this ticket…"
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="modal__form-actions">
              <button type="submit" form="ticket-form" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Ticket'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </form>

          {/* ── Thread ── */}
          {isEdit && (
            <>
              <div className="modal__thread-header">
                <span className="material-symbols-outlined">forum</span>
                Activity &amp; Responses
              </div>

              <div className="modal__thread">
                {evtLoad ? (
                  <div className="thread-loading">Loading…</div>
                ) : events.length === 0 ? (
                  <div className="thread-loading">No activity yet.</div>
                ) : (
                  events.map((ev, i) => (
                    ev.event_type === 'comment'
                      ? <CommentBubble key={ev.id} ev={ev} currentUserId={user?.id} />
                      : <EventLine    key={ev.id} ev={ev} isLast={i === events.length - 1} />
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Merge (admin) ── */}
          {isAdmin && isEdit && (
            <div className="modal__merge">
              <button className="modal__merge-toggle" onClick={() => setMergeOpen(o => !o)} type="button">
                <span className="material-symbols-outlined">merge</span>
                Merge other tickets into this one
                <span className="material-symbols-outlined modal__merge-chevron">
                  {mergeOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {mergeOpen && (
                <div className="modal__merge-body">
                  {mergeMsg && (
                    <div className={`modal__merge-msg ${mergeMsg.includes('failed') ? 'modal__merge-msg--error' : 'modal__merge-msg--success'}`}>
                      {mergeMsg}
                    </div>
                  )}
                  <div className="modal__merge-search">
                    <span className="material-symbols-outlined modal__merge-search-icon">search</span>
                    <input className="modal__merge-search-input" type="search"
                      placeholder="Search tickets to merge…" value={mergeSearch}
                      onChange={e => setMergeSearch(e.target.value)} />
                  </div>
                  {filteredForMerge.length === 0 ? (
                    <p className="modal__merge-empty">
                      {allTickets.length === 0 ? 'No other open tickets.' : 'No tickets match.'}
                    </p>
                  ) : (
                    <div className="modal__merge-list">
                      {filteredForMerge.map(t => (
                        <label key={t.id} className={`merge-item${selectedIds.includes(t.id) ? ' merge-item--selected' : ''}`}>
                          <input type="checkbox" className="merge-item__check"
                            checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                          <div className="merge-item__info">
                            <div className="merge-item__title">{t.title}</div>
                            <div className="merge-item__meta">
                              #{t.id.slice(0,6).toUpperCase()}
                              <span> · </span>
                              <span className={`badge badge--${t.priority}`}>{t.priority}</span>
                              <span> · </span>{t.creator_name}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedIds.length > 0 && (
                    <button className="btn btn--primary modal__merge-confirm" onClick={handleMerge}
                      disabled={merging} type="button">
                      <span className="material-symbols-outlined">merge</span>
                      {merging ? 'Merging…' : `Merge ${selectedIds.length} ticket${selectedIds.length !== 1 ? 's' : ''} into this one`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>{/* end modal__body */}

        {/* ── Response footer (only on existing tickets) ── */}
        {isEdit && (
          <div className="modal__reply-footer">
            {replyErr && <div className="modal__error modal__error--sm">{replyErr}</div>}
            <form className="modal__reply-form" onSubmit={handleReply}>
              <textarea
                className="form-textarea modal__reply-input"
                rows={2}
                placeholder="Write a response…"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(e);
                }}
              />
              <button className="btn btn--primary modal__reply-btn" type="submit"
                disabled={posting || !reply.trim()}>
                <span className="material-symbols-outlined">send</span>
                {posting ? 'Sending…' : 'Post Response'}
              </button>
            </form>
            <div className="modal__reply-hint">Ctrl+Enter to send</div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Comment bubble ─────────────────────────────────────────
function CommentBubble({ ev, currentUserId }) {
  const isOwn = ev.user_id === currentUserId;
  const isResolution = ev.detail.startsWith('[Resolution]');
  const body = isResolution ? ev.detail.replace('[Resolution] ', '') : ev.detail;

  return (
    <div className={`comment-bubble${isOwn ? ' comment-bubble--own' : ''}`}>
      <div className="comment-bubble__avatar">{ev.user_name.charAt(0).toUpperCase()}</div>
      <div className="comment-bubble__content">
        <div className="comment-bubble__header">
          <span className="comment-bubble__name">{ev.user_name}</span>
          {isResolution && (
            <span className="comment-bubble__resolution-tag">
              <span className="material-symbols-outlined">task_alt</span> Resolution
            </span>
          )}
          <span className="comment-bubble__time">{fmtDate(ev.created_at)}</span>
        </div>
        <div className="comment-bubble__body">{body}</div>
      </div>
    </div>
  );
}

// ── System event line ──────────────────────────────────────
function EventLine({ ev }) {
  const icons = {
    created:          'confirmation_number',
    status_changed:   'swap_horiz',
    priority_changed: 'flag',
    assigned:         'person',
    merged:           'merge',
  };
  const icon = icons[ev.event_type] || 'info';

  return (
    <div className="event-line">
      <span className="material-symbols-outlined event-line__icon">{icon}</span>
      <span className="event-line__detail">{ev.detail}</span>
      <span className="event-line__meta">{ev.user_name} · {fmtDate(ev.created_at)}</span>
    </div>
  );
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
