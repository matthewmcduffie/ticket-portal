import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import '../Tickets/TicketModal.css';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime) {
  if (IMAGE_TYPES.has(mime)) return 'image';
  if (mime === 'application/pdf') return 'picture_as_pdf';
  if (mime?.includes('word')) return 'description';
  if (mime?.includes('excel') || mime?.includes('spreadsheet') || mime === 'text/csv') return 'table_chart';
  if (mime === 'application/zip' || mime?.includes('zip')) return 'folder_zip';
  return 'attach_file';
}

export default function ProjectTicketModal({ projectId, ticket, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit = !!ticket;
  const threadRef = useRef(null);
  const newFileRef = useRef(null);
  const replyFileRef = useRef(null);

  const [form, setForm] = useState({
    title:        ticket?.title        ?? '',
    description:  ticket?.description  ?? '',
    priority:     ticket?.priority     ?? 'medium',
    status:       ticket?.status       ?? 'open',
    issue_type:   ticket?.issue_type   ?? 'ticket',
    due_date:     ticket?.due_date     ? ticket.due_date.slice(0, 10) : '',
    milestone_id: ticket?.milestone_id ?? '',
  });
  const isBug = form.issue_type === 'bug';
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const [milestones, setMilestones] = useState([]);
  const [labels, setLabels] = useState([]);
  const [ticketLabelIds, setTicketLabelIds] = useState(() => (ticket?.labels || []).map(l => l.id));
  const [savingLabels, setSavingLabels] = useState(false);

  const [uploadConfig, setUploadConfig] = useState({ enabled: true, maxFileSizeMb: 25, maxTotalSizeMb: 100 });
  const [newFiles, setNewFiles] = useState([]);
  const [replyFiles, setReplyFiles] = useState([]);

  const [events, setEvents] = useState([]);
  const [evtLoad, setEvtLoad] = useState(true);

  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyErr, setReplyErr] = useState('');

  useEffect(() => {
    api.get('/attachments/config').then(r => setUploadConfig(r.data)).catch(() => {});
    api.get(`/projects/${projectId}/milestones`).then(r => setMilestones(r.data)).catch(() => {});
    api.get(`/projects/${projectId}/labels`).then(r => setLabels(r.data)).catch(() => {});
  }, [projectId]);

  function loadEvents() {
    if (!isEdit) return;
    api.get(`/projects/${projectId}/tickets/${ticket.id}/events`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setEvtLoad(false));
  }

  useEffect(() => { loadEvents(); }, [ticket?.id]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [events]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function toggleLabel(id) {
    setTicketLabelIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  async function saveLabels(ticketId) {
    setSavingLabels(true);
    try {
      await api.put(`/projects/${projectId}/tickets/${ticketId}/labels`, { label_ids: ticketLabelIds });
    } catch { /* non-fatal */ }
    finally { setSavingLabels(false); }
  }

  async function uploadFiles(ticketId, files) {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    await api.post(`/projects/${projectId}/tickets/${ticketId}/attachments`, fd);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormErr('');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/projects/${projectId}/tickets/${ticket.id}`, form);
        await saveLabels(ticket.id);
      } else {
        const { data: created } = await api.post(`/projects/${projectId}/tickets`, form);
        if (ticketLabelIds.length) await saveLabels(created.id);
        if (newFiles.length) await uploadFiles(created.id, newFiles);
      }
      onSaved();
    } catch (err) {
      setFormErr(err.response?.data?.error || `Failed to save ${isBug ? 'bug' : 'ticket'}`);
    } finally {
      setSaving(false);
    }
  }

  function addNewFiles(fileList) { setNewFiles(prev => [...prev, ...Array.from(fileList)]); }
  function removeNewFile(i) { setNewFiles(prev => prev.filter((_, idx) => idx !== i)); }
  function addReplyFiles(fileList) { setReplyFiles(prev => [...prev, ...Array.from(fileList)]); }
  function removeReplyFile(i) { setReplyFiles(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim() && !replyFiles.length) return;
    setReplyErr('');
    setPosting(true);
    try {
      if (reply.trim()) {
        await api.post(`/projects/${projectId}/tickets/${ticket.id}/comments`, { body: reply.trim() });
      }
      if (replyFiles.length) {
        await uploadFiles(ticket.id, replyFiles);
      }
      setReply('');
      setReplyFiles([]);
      loadEvents();
    } catch (err) {
      setReplyErr(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide" role="dialog" aria-modal="true">
        <div className="modal__header">
          <div className="modal__header-left">
            {isEdit && <span className="modal__ticket-id">#{ticket.id.slice(0, 6).toUpperCase()}</span>}
            <h2 className="modal__title">{isEdit ? (form.title || 'Project ticket') : (isBug ? 'New Bug' : 'New Ticket')}</h2>
            <span className={`badge badge--status badge--${isBug ? 'in_progress' : 'open'}`}>
              {isBug ? 'Bug' : 'Ticket'}
            </span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal__body" ref={threadRef}>
          <form className="modal__form" onSubmit={handleSave} id="proj-ticket-form">
            {formErr && <div className="modal__error" role="alert">{formErr}</div>}

            <div className="form-field">
              <label className="form-label" htmlFor="pt-title">Title</label>
              <input id="pt-title" name="title" className="form-input" value={form.title}
                onChange={handleChange} required autoFocus={!isEdit} />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="pt-desc">Description</label>
              <textarea id="pt-desc" name="description" className="form-textarea" rows={3}
                value={form.description} onChange={handleChange} />
            </div>

            <div className="modal__form-row">
              {!isEdit && (
                <div className="form-field">
                  <label className="form-label" htmlFor="pt-issue-type">Create as</label>
                  <select id="pt-issue-type" name="issue_type" className="form-select"
                    value={form.issue_type} onChange={handleChange}>
                    <option value="ticket">Ticket</option>
                    <option value="bug">Bug</option>
                  </select>
                </div>
              )}
              <div className="form-field">
                <label className="form-label" htmlFor="pt-priority">Priority</label>
                <select id="pt-priority" name="priority" className="form-select"
                  value={form.priority} onChange={handleChange}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              {isEdit && (
                <div className="form-field">
                  <label className="form-label" htmlFor="pt-status">Status</label>
                  <select id="pt-status" name="status" className="form-select"
                    value={form.status} onChange={handleChange}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )}
            </div>

            <div className="modal__form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="pt-due">Due date</label>
                <input id="pt-due" name="due_date" type="date" className="form-input"
                  value={form.due_date} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="pt-milestone">Milestone</label>
                <select id="pt-milestone" name="milestone_id" className="form-select"
                  value={form.milestone_id} onChange={handleChange}>
                  <option value="">No milestone</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {labels.length > 0 && (
              <div className="form-field">
                <label className="form-label">Labels</label>
                <div className="label-picker">
                  {labels.map(l => (
                    <button
                      type="button"
                      key={l.id}
                      className={`label-chip${ticketLabelIds.includes(l.id) ? ' label-chip--active' : ''}`}
                      style={{ '--label-color': l.color }}
                      onClick={() => toggleLabel(l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File picker — new ticket only */}
            {!isEdit && uploadConfig.enabled && (
              <div className="form-field">
                <label className="form-label">
                  <span className="material-symbols-outlined" style={{fontSize:'16px',verticalAlign:'middle'}}>attach_file</span>
                  {' '}Attachments
                </label>
                <div
                  className="modal__drop-zone"
                  onClick={() => newFileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('modal__drop-zone--over'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('modal__drop-zone--over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('modal__drop-zone--over'); addNewFiles(e.dataTransfer.files); }}
                >
                  <span className="material-symbols-outlined modal__drop-icon">cloud_upload</span>
                  <span>Drop files here or <strong>click to browse</strong></span>
                  <span className="modal__drop-hint">Images, PDF, Word, Excel, ZIP - up to {uploadConfig.maxFileSizeMb} MB each</span>
                </div>
                <input ref={newFileRef} type="file" multiple className="modal__file-hidden"
                  onChange={e => addNewFiles(e.target.files)} />
                {newFiles.length > 0 && (
                  <div className="modal__file-chips">
                    {newFiles.map((f, i) => (
                      <div key={i} className="file-chip">
                        <span className="material-symbols-outlined file-chip__icon">{fileIcon(f.type)}</span>
                        <span className="file-chip__name">{f.name}</span>
                        <span className="file-chip__size">{fmtBytes(f.size)}</span>
                        <button type="button" className="file-chip__remove" onClick={() => removeNewFile(i)}>
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal__form-actions">
              <button type="submit" form="proj-ticket-form" className="btn btn--primary" disabled={saving || savingLabels}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : isBug ? 'Create Bug' : 'Create Ticket'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </form>

          {isEdit && (
            <>
              <div className="modal__thread-header">
                <span className="material-symbols-outlined">forum</span>
                Activity &amp; Comments
              </div>
              <div className="modal__thread">
                {evtLoad ? (
                  <div className="thread-loading">Loading…</div>
                ) : events.length === 0 ? (
                  <div className="thread-loading">No activity yet.</div>
                ) : (
                  events.map(ev => {
                    if (ev.event_type === 'comment')
                      return <CommentBubble key={ev.id} ev={ev} currentUserId={user?.id} />;
                    if (ev.event_type === 'attachment')
                      return <ProjectAttachmentCard key={ev.id} ev={ev} />;
                    return <EventLine key={ev.id} ev={ev} />;
                  })
                )}
              </div>
            </>
          )}
        </div>

        {isEdit && (
          <div className="modal__reply-footer">
            {replyErr && <div className="modal__error modal__error--sm">{replyErr}</div>}

            {uploadConfig.enabled && replyFiles.length > 0 && (
              <div className="modal__file-chips">
                {replyFiles.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span className="material-symbols-outlined file-chip__icon">{fileIcon(f.type)}</span>
                    <span className="file-chip__name">{f.name}</span>
                    <span className="file-chip__size">{fmtBytes(f.size)}</span>
                    <button type="button" className="file-chip__remove" onClick={() => removeReplyFile(i)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form className="modal__reply-form" onSubmit={handleReply}>
              {uploadConfig.enabled && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost modal__attach-btn"
                    title="Attach files"
                    onClick={() => replyFileRef.current?.click()}
                  >
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <input ref={replyFileRef} type="file" multiple className="modal__file-hidden"
                    onChange={e => { addReplyFiles(e.target.files); e.target.value = ''; }} />
                </>
              )}
              <textarea
                className="form-textarea modal__reply-input"
                rows={2}
                placeholder="Write a comment… (use @name to mention a teammate)"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(e); }}
              />
              <button className="btn btn--primary modal__reply-btn" type="submit" disabled={posting || (!reply.trim() && !replyFiles.length)}>
                <span className="material-symbols-outlined">send</span>
                {posting ? 'Sending…' : 'Post'}
              </button>
            </form>
            <div className="modal__reply-hint">
              Ctrl+Enter to send{uploadConfig.enabled ? ' · Paperclip to attach files' : ''} · @name to mention
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentBubble({ ev, currentUserId }) {
  const isOwn = ev.user_id === currentUserId;
  return (
    <div className={`comment-bubble${isOwn ? ' comment-bubble--own' : ''}`}>
      <div className="comment-bubble__avatar">{ev.user_name.charAt(0).toUpperCase()}</div>
      <div className="comment-bubble__content">
        <div className="comment-bubble__header">
          <span className="comment-bubble__name">{ev.user_name}</span>
          <span className="comment-bubble__time">{fmtDate(ev.created_at)}</span>
        </div>
        <div className="comment-bubble__body">{renderMentions(ev.detail)}</div>
      </div>
    </div>
  );
}

const MENTION_RE = /(@[a-z0-9._-]+)/gi;

function renderMentions(text) {
  return text.split(MENTION_RE).map((part, i) =>
    MENTION_RE.test(part) ? <span key={i} className="mention-tag">{part}</span> : part
  );
}

function ProjectAttachmentCard({ ev }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await api.get(`/attachments/${ev.attachment_id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.detail;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  return (
    <div className="attachment-card">
      <div className="attachment-card__icon-wrap">
        <span className="material-symbols-outlined attachment-card__icon">attach_file</span>
      </div>
      <div className="attachment-card__info">
        <span className="attachment-card__name">{ev.detail}</span>
        <span className="attachment-card__meta">{ev.user_name} · {fmtDate(ev.created_at)}</span>
      </div>
      <button className="btn btn--ghost attachment-card__btn" onClick={download} disabled={busy}>
        <span className="material-symbols-outlined">download</span>
      </button>
    </div>
  );
}

function EventLine({ ev }) {
  const icons = {
    created:          'confirmation_number',
    status_changed:   'swap_horiz',
    priority_changed: 'flag',
    assigned:         'person',
  };
  return (
    <div className="event-line">
      <span className="material-symbols-outlined event-line__icon">{icons[ev.event_type] || 'info'}</span>
      <span className="event-line__detail">{ev.detail}</span>
      <span className="event-line__meta">{ev.user_name} · {fmtDate(ev.created_at)}</span>
    </div>
  );
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now - d) / 60000);
  if (diffMins < 1)    return 'just now';
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
