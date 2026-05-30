import React, { useState } from 'react';
import api from '../../services/api.js';
import './TicketModal.css';

export default function TicketModal({ ticket, onClose, onSaved }) {
  const isEdit = !!ticket;
  const [form, setForm] = useState({
    title:       ticket?.title       ?? '',
    description: ticket?.description ?? '',
    priority:    ticket?.priority    ?? 'medium',
    status:      ticket?.status      ?? 'open',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal__header">
          <h2 className="modal__title">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          {error && <div className="modal__error" role="alert">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="modal-title">Title</label>
            <input
              id="modal-title"
              name="title"
              className="form-input"
              value={form.title}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="modal-desc">Description</label>
            <textarea
              id="modal-desc"
              name="description"
              className="form-textarea"
              rows={4}
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div className="modal__form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="modal-priority">Priority</label>
              <select
                id="modal-priority"
                name="priority"
                className="form-select"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {isEdit && (
              <div className="form-field">
                <label className="form-label" htmlFor="modal-status">Status</label>
                <select
                  id="modal-status"
                  name="status"
                  className="form-select"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
