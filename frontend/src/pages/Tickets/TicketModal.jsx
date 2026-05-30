import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './TicketModal.css';

export default function TicketModal({ ticket, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit  = !!ticket;
  const isAdmin = user?.role === 'admin';

  const [form, setForm] = useState({
    title:       ticket?.title       ?? '',
    description: ticket?.description ?? '',
    priority:    ticket?.priority    ?? 'medium',
    status:      ticket?.status      ?? 'open',
  });
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);

  // Merge state
  const [mergeOpen,    setMergeOpen]    = useState(false);
  const [allTickets,   setAllTickets]   = useState([]);
  const [mergeSearch,  setMergeSearch]  = useState('');
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [merging,      setMerging]      = useState(false);
  const [mergeMsg,     setMergeMsg]     = useState('');

  useEffect(() => {
    if (mergeOpen && isAdmin && isEdit) {
      api.get('/tickets?limit=200').then(r => {
        setAllTickets(r.data.filter(t => t.id !== ticket.id && t.status !== 'closed'));
      }).catch(console.error);
    }
  }, [mergeOpen, isAdmin, isEdit, ticket?.id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/tickets/${ticket.id}`, form);
      } else {
        await api.post('/tickets', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleMerge() {
    if (selectedIds.length === 0) return;
    setMerging(true);
    setMergeMsg('');
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/merge`, { ticket_ids: selectedIds });
      setMergeMsg(`Merged ${data.merged.length} ticket${data.merged.length !== 1 ? 's' : ''} into this one.`);
      setSelectedIds([]);
      setAllTickets(prev => prev.filter(t => !selectedIds.includes(t.id)));
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
      <div className="modal" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Ticket Details' : 'New Ticket'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Main form ── */}
        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <div className="modal__error" role="alert">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="modal-title">Title</label>
            <input id="modal-title" name="title" className="form-input"
              value={form.title} onChange={handleChange} required autoFocus />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="modal-desc">Description</label>
            <textarea id="modal-desc" name="description" className="form-textarea"
              rows={4} value={form.description} onChange={handleChange} />
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

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Ticket'}
            </button>
          </div>
        </form>

        {/* ── Merge section (admin + edit only) ── */}
        {isAdmin && isEdit && (
          <div className="modal__merge">
            <button
              className="modal__merge-toggle"
              onClick={() => setMergeOpen(o => !o)}
              type="button"
            >
              <span className="material-symbols-outlined">merge</span>
              Merge other tickets into this one
              <span className="material-symbols-outlined modal__merge-chevron">
                {mergeOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {mergeOpen && (
              <div className="modal__merge-body">
                {mergeMsg && (
                  <div className={`modal__merge-msg ${mergeMsg.includes('failed') || mergeMsg.includes('error') ? 'modal__merge-msg--error' : 'modal__merge-msg--success'}`}>
                    {mergeMsg}
                  </div>
                )}

                <div className="modal__merge-search">
                  <span className="material-symbols-outlined modal__merge-search-icon">search</span>
                  <input
                    className="modal__merge-search-input"
                    type="search"
                    placeholder="Search tickets to merge…"
                    value={mergeSearch}
                    onChange={e => setMergeSearch(e.target.value)}
                  />
                </div>

                {filteredForMerge.length === 0 ? (
                  <p className="modal__merge-empty">
                    {allTickets.length === 0 ? 'No other open tickets to merge.' : 'No tickets match your search.'}
                  </p>
                ) : (
                  <div className="modal__merge-list">
                    {filteredForMerge.map(t => (
                      <label key={t.id} className={`merge-item${selectedIds.includes(t.id) ? ' merge-item--selected' : ''}`}>
                        <input
                          type="checkbox"
                          className="merge-item__check"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                        <div className="merge-item__info">
                          <div className="merge-item__title">{t.title}</div>
                          <div className="merge-item__meta">
                            #{t.id.slice(0, 6).toUpperCase()}
                            <span> · </span>
                            <span className={`badge badge--${t.priority}`}>{t.priority}</span>
                            <span> · </span>
                            {t.creator_name}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedIds.length > 0 && (
                  <button
                    className="btn btn--primary modal__merge-confirm"
                    onClick={handleMerge}
                    disabled={merging}
                    type="button"
                  >
                    <span className="material-symbols-outlined">merge</span>
                    {merging ? 'Merging…' : `Merge ${selectedIds.length} ticket${selectedIds.length !== 1 ? 's' : ''} into this one`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
