import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './TicketModal.css';

const NEEDS_RESOLUTION_NOTE = ['resolved', 'closed'];

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

export default function TicketModal({ ticket, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit  = !!ticket;
  const isAdmin = user?.role === 'admin';
  const threadRef = useRef(null);
  const fileInputRef = useRef(null);
  const newTicketFileRef = useRef(null);

  // ── Upload config ────────────────────────────────────────
  const [uploadConfig, setUploadConfig] = useState({ enabled: true, maxFileSizeMb: 25, maxTotalSizeMb: 100 });

  useEffect(() => {
    api.get('/attachments/config').then(r => setUploadConfig(r.data)).catch(() => {});
  }, []);

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

  // Files for new ticket creation
  const [newTicketFiles, setNewTicketFiles] = useState([]);

  const statusChanged = isEdit && form.status !== ticket?.status;
  const needsResNote  = statusChanged && NEEDS_RESOLUTION_NOTE.includes(form.status);

  // ── Thread ───────────────────────────────────────────────
  const [events,  setEvents]  = useState([]);
  const [evtLoad, setEvtLoad] = useState(true);

  // ── Response input ───────────────────────────────────────
  const [reply,    setReply]    = useState('');
  const [posting,  setPosting]  = useState(false);
  const [replyErr, setReplyErr] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);

  // ── Sharing ──────────────────────────────────────────────
  const [shares,      setShares]      = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [shareOpen,   setShareOpen]   = useState(false);
  const [shareUserId, setShareUserId] = useState('');
  const [sharing,     setSharing]     = useState(false);
  const [shareMsg,    setShareMsg]    = useState('');

  const canShare = isEdit && (isAdmin || ticket?.created_by === user?.id);

  function loadShares() {
    if (!isEdit) return;
    api.get(`/tickets/${ticket.id}/shares`).then(r => setShares(r.data)).catch(() => {});
  }

  useEffect(() => {
    if (!canShare) return;
    loadShares();
    api.get('/users').then(r => setAllUsers(r.data)).catch(() => {});
  }, [ticket?.id]);

  const shareableUsers = allUsers.filter(
    u => u.id !== ticket?.created_by && !shares.some(s => s.id === u.id)
  );

  async function handleShare() {
    if (!shareUserId) return;
    setSharing(true);
    setShareMsg('');
    try {
      await api.post(`/tickets/${ticket.id}/shares`, { user_id: shareUserId });
      setShareUserId('');
      loadShares();
    } catch (err) {
      setShareMsg(err.response?.data?.error || 'Failed to share');
    } finally { setSharing(false); }
  }

  async function handleUnshare(userId) {
    try {
      await api.delete(`/tickets/${ticket.id}/shares/${userId}`);
      loadShares();
    } catch { setShareMsg('Failed to remove'); }
  }

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

  useEffect(() => { loadEvents(); }, [ticket?.id]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
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
        if (needsResNote && resolutionNote.trim()) {
          await api.post(`/tickets/${ticket.id}/comments`, {
            body: `[Resolution] ${resolutionNote.trim()}`,
          });
        }
      } else {
        const { data: created } = await api.post('/tickets', form);
        if (newTicketFiles.length) {
          const fd = new FormData();
          newTicketFiles.forEach(f => fd.append('files', f));
          await api.post(`/tickets/${created.id}/attachments`, fd);
        }
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
    if (!reply.trim() && !replyFiles.length) return;
    setReplyErr('');
    setPosting(true);
    try {
      if (reply.trim()) {
        await api.post(`/tickets/${ticket.id}/comments`, { body: reply.trim() });
      }
      if (replyFiles.length) {
        const fd = new FormData();
        replyFiles.forEach(f => fd.append('files', f));
        await api.post(`/tickets/${ticket.id}/attachments`, fd);
      }
      setReply('');
      setReplyFiles([]);
      loadEvents();
    } catch (err) {
      setReplyErr(err.response?.data?.error || 'Failed to post response');
    } finally {
      setPosting(false);
    }
  }

  function addReplyFiles(fileList) {
    setReplyFiles(prev => [...prev, ...Array.from(fileList)]);
  }

  function removeReplyFile(index) {
    setReplyFiles(prev => prev.filter((_, i) => i !== index));
  }

  function addNewTicketFiles(fileList) {
    setNewTicketFiles(prev => [...prev, ...Array.from(fileList)]);
  }

  function removeNewTicketFile(index) {
    setNewTicketFiles(prev => prev.filter((_, i) => i !== index));
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

            {/* Resolution note */}
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

            {/* File picker — new ticket only */}
            {!isEdit && uploadConfig.enabled && (
              <div className="form-field">
                <label className="form-label">
                  <span className="material-symbols-outlined" style={{fontSize:'16px',verticalAlign:'middle'}}>attach_file</span>
                  {' '}Attachments
                </label>
                <div className="modal__phi-notice" role="note">
                  <span className="material-symbols-outlined">privacy_tip</span>
                  Do not attach screenshots or files containing protected health information (PHI).
                </div>
                <div
                  className="modal__drop-zone"
                  onClick={() => newTicketFileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('modal__drop-zone--over'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('modal__drop-zone--over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('modal__drop-zone--over'); addNewTicketFiles(e.dataTransfer.files); }}
                >
                  <span className="material-symbols-outlined modal__drop-icon">cloud_upload</span>
                  <span>Drop files here or <strong>click to browse</strong></span>
                  <span className="modal__drop-hint">Images, PDF, Word, Excel, ZIP — up to 25 MB each</span>
                </div>
                <input ref={newTicketFileRef} type="file" multiple className="modal__file-hidden"
                  onChange={e => addNewTicketFiles(e.target.files)} />
                {newTicketFiles.length > 0 && (
                  <div className="modal__file-chips">
                    {newTicketFiles.map((f, i) => (
                      <div key={i} className="file-chip">
                        <span className="material-symbols-outlined file-chip__icon">{fileIcon(f.type)}</span>
                        <span className="file-chip__name">{f.name}</span>
                        <span className="file-chip__size">{fmtBytes(f.size)}</span>
                        <button type="button" className="file-chip__remove" onClick={() => removeNewTicketFile(i)}>
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  events.map(ev => {
                    if (ev.event_type === 'comment')
                      return <CommentBubble key={ev.id} ev={ev} currentUserId={user?.id} />;
                    if (ev.event_type === 'attachment')
                      return <AttachmentCard key={ev.id} ev={ev} />;
                    return <EventLine key={ev.id} ev={ev} />;
                  })
                )}
              </div>
            </>
          )}

          {/* ── Sharing ── */}
          {canShare && (
            <div className="modal__share">
              <button className="modal__share-toggle" onClick={() => setShareOpen(o => !o)} type="button">
                <span className="material-symbols-outlined">group_add</span>
                Share this ticket
                <span className="material-symbols-outlined modal__share-chevron">
                  {shareOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {shareOpen && (
                <div className="modal__share-body">
                  {shareMsg && <div className="modal__share-msg modal__share-msg--error">{shareMsg}</div>}

                  {shares.length > 0 && (
                    <div className="modal__share-list">
                      {shares.map(s => (
                        <div key={s.id} className="share-item">
                          <div className="share-item__avatar">{s.name.charAt(0).toUpperCase()}</div>
                          <div className="share-item__info">
                            <div className="share-item__name">{s.name}</div>
                            <div className="share-item__email">{s.email}</div>
                          </div>
                          <button type="button" className="share-item__remove" title="Remove access"
                            onClick={() => handleUnshare(s.id)}>
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {shareableUsers.length > 0 ? (
                    <div className="modal__share-add">
                      <select className="form-select modal__share-select" value={shareUserId}
                        onChange={e => setShareUserId(e.target.value)}>
                        <option value="">Select a user to share with…</option>
                        {shareableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn--primary btn--sm" onClick={handleShare}
                        disabled={!shareUserId || sharing}>
                        {sharing ? '…' : 'Share'}
                      </button>
                    </div>
                  ) : (
                    shares.length === 0 && (
                      <p className="modal__share-empty">No other users to share with.</p>
                    )
                  )}
                </div>
              )}
            </div>
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

        {/* ── Response footer (existing tickets only) ── */}
        {isEdit && (
          <div className="modal__reply-footer">
            {replyErr && <div className="modal__error modal__error--sm">{replyErr}</div>}

            {/* File chips */}
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

            {uploadConfig.enabled && (
              <div className="modal__phi-notice" role="note">
                <span className="material-symbols-outlined">privacy_tip</span>
                Do not attach screenshots or files containing protected health information (PHI).
              </div>
            )}
            <form className="modal__reply-form" onSubmit={handleReply}>
              {uploadConfig.enabled && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost modal__attach-btn"
                    title="Attach files"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="modal__file-hidden"
                    onChange={e => { addReplyFiles(e.target.files); e.target.value = ''; }} />
                </>
              )}
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
                disabled={posting || (!reply.trim() && !replyFiles.length)}>
                <span className="material-symbols-outlined">send</span>
                {posting ? 'Sending…' : 'Post'}
              </button>
            </form>
            <div className="modal__reply-hint">
              Ctrl+Enter to send{uploadConfig.enabled ? ' · Paperclip to attach files' : ''}
            </div>
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

// ── Attachment card ────────────────────────────────────────
function AttachmentCard({ ev }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await api.get(`/attachments/${ev.attachment_id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.detail;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed.');
    } finally {
      setLoading(false);
    }
  }

  const isImage = res => res?.data?.type && IMAGE_TYPES.has(res.data.type);

  return (
    <div className="attachment-card">
      <div className="attachment-card__icon-wrap">
        <span className="material-symbols-outlined attachment-card__icon">attach_file</span>
      </div>
      <div className="attachment-card__info">
        <span className="attachment-card__name">{ev.detail}</span>
        <span className="attachment-card__meta">{ev.user_name} · {fmtDate(ev.created_at)}</span>
      </div>
      <button
        className="btn btn--ghost attachment-card__btn"
        onClick={handleDownload}
        disabled={loading}
        title="Download"
      >
        <span className="material-symbols-outlined">{loading ? 'hourglass_empty' : 'download'}</span>
      </button>
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
  const diffMins = Math.floor((now - d) / 60000);
  if (diffMins < 1)    return 'just now';
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
