import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import Tooltip from '../../components/Tooltip/Tooltip.jsx';
import './Equipment.css';

const STATUS_TIP = {
  pending:   'Pending — request submitted but not yet reviewed.',
  approved:  'Approved — reviewed and cleared for fulfillment.',
  fulfilled: 'Fulfilled — equipment has been delivered to the new hire.',
};

const EQUIPMENT_ITEMS = ['Laptop', 'Monitor', 'Keyboard', 'Mouse'];

const ITEM_ICONS = {
  Laptop: 'laptop_mac',
  Monitor: 'monitor',
  Keyboard: 'keyboard',
  Mouse: 'mouse',
};

const EVENT_ICONS = {
  created: 'add_circle',
  status_change: 'swap_horiz',
  field_edit: 'edit',
  comment: 'chat_bubble',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EquipmentDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [request, setRequest]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');
  const [comment, setComment]     = useState('');
  const [posting, setPosting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(() => {
    api.get(`/equipment/${id}`)
      .then(r => setRequest(r.data))
      .catch(() => setError('Failed to load request.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard', { replace: true }); return; }
    load();
  }, [user, navigate, load]);

  function startEdit() {
    setEditForm({
      hire_name: request.hire_name,
      hire_department: request.hire_department,
      hire_start_date: request.hire_start_date?.slice(0, 10) || '',
      requestor_name: request.requestor_name,
      items: [...(request.items || [])],
      due_date: request.due_date?.slice(0, 10) || '',
      notes: request.notes || '',
    });
    setSaveErr('');
    setEditing(true);
  }

  function toggleItem(item) {
    setEditForm(f => ({
      ...f,
      items: f.items.includes(item)
        ? f.items.filter(i => i !== item)
        : [...f.items, item],
    }));
  }

  async function saveEdit() {
    setSaveErr('');
    if (!editForm.hire_name?.trim() || !editForm.hire_department?.trim() ||
        !editForm.hire_start_date || !editForm.requestor_name?.trim() || !editForm.due_date) {
      setSaveErr('All required fields must be filled.');
      return;
    }
    if (!editForm.items.length) { setSaveErr('Select at least one item.'); return; }
    setSaving(true);
    try {
      await api.patch(`/equipment/${id}`, editForm);
      setEditing(false);
      setLoading(true);
      load();
    } catch (err) {
      setSaveErr(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status) {
    try {
      await api.patch(`/equipment/${id}`, { status });
      setRequest(r => ({ ...r, status }));
      load();
    } catch { /* ignore */ }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api.post(`/equipment/${id}/comments`, { detail: comment });
      setComment('');
      load();
    } finally { setPosting(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/equipment/${id}`);
      navigate('/equipment');
    } finally { setDeleting(false); }
  }

  if (loading) return <div className="eq-loading">Loading…</div>;
  if (error)   return <div className="eq-error">{error}</div>;
  if (!request) return null;

  const events = request.events || [];

  return (
    <div className="eq-detail">
      <button className="eq-form-page__back" onClick={() => navigate('/equipment')}>
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
        Back to Equipment Requests
      </button>

      <div className="eq-detail__header">
        <div className="eq-detail__title-block">
          <h1 className="eq-detail__hire">{request.hire_name}</h1>
          <p className="eq-detail__requestor">
            {request.hire_department} · Requested by {request.requestor_name}
          </p>
        </div>
        <div className="eq-detail__actions">
          {!editing && (
            <button className="btn btn--ghost btn--sm" onClick={startEdit}>
              <span className="material-symbols-outlined">edit</span>
              Edit
            </button>
          )}
          <button
            className="btn btn--ghost btn--sm"
            style={{ color: '#dc2626' }}
            onClick={() => setConfirmDelete(c => !c)}
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="eq-delete-confirm">
          <span className="eq-delete-confirm__text">Delete this request permanently?</span>
          <div className="eq-delete-confirm__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn--sm" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      <div className="eq-detail__card">
        <div className="eq-detail__card-title">Status</div>
        <div className="eq-status-selector">
          {['pending', 'approved', 'fulfilled'].map(s => (
            <Tooltip key={s} text={STATUS_TIP[s]} position="top">
              <button
                className={`eq-status-btn eq-status-btn--${s}${request.status === s ? ' eq-status-btn--active' : ''}`}
                onClick={() => request.status !== s && changeStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {editing ? (
        <div className="eq-detail__card">
          <div className="eq-detail__card-title">Edit Request</div>
          <div className="eq-edit-row">
            <div className="eq-edit-field">
              <label className="eq-edit-label">Full Name *</label>
              <input className="form-input" value={editForm.hire_name}
                onChange={e => setEditForm(f => ({ ...f, hire_name: e.target.value }))} />
            </div>
            <div className="eq-edit-field">
              <label className="eq-edit-label">Department *</label>
              <input className="form-input" value={editForm.hire_department}
                onChange={e => setEditForm(f => ({ ...f, hire_department: e.target.value }))} />
            </div>
            <div className="eq-edit-field">
              <label className="eq-edit-label">Start Date *</label>
              <input type="date" className="form-input" value={editForm.hire_start_date}
                onChange={e => setEditForm(f => ({ ...f, hire_start_date: e.target.value }))} />
            </div>
            <div className="eq-edit-field">
              <label className="eq-edit-label">Requestor Name *</label>
              <input className="form-input" value={editForm.requestor_name}
                onChange={e => setEditForm(f => ({ ...f, requestor_name: e.target.value }))} />
            </div>
            <div className="eq-edit-field">
              <label className="eq-edit-label">Due Date *</label>
              <input type="date" className="form-input" value={editForm.due_date}
                onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="eq-edit-field eq-edit-field--full">
              <label className="eq-edit-label">Items *</label>
              <div className="eq-items">
                {EQUIPMENT_ITEMS.map(item => (
                  <label
                    key={item}
                    className={`eq-item-check${editForm.items.includes(item) ? ' eq-item-check--selected' : ''}`}
                  >
                    <input type="checkbox" checked={editForm.items.includes(item)} onChange={() => toggleItem(item)} />
                    <span className="material-symbols-outlined eq-item-check__icon">{ITEM_ICONS[item]}</span>
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="eq-edit-field eq-edit-field--full">
              <label className="eq-edit-label">Notes</label>
              <textarea className="form-input" rows={3} value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {saveErr && <p className="eq-form__error">{saveErr}</p>}
          <div className="eq-edit-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn--primary btn--sm" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="eq-detail__card">
          <div className="eq-detail__card-title">Request Details</div>
          <div className="eq-detail__fields">
            <div>
              <div className="eq-detail__field-label">Start Date</div>
              <div className="eq-detail__field-value">{formatDate(request.hire_start_date)}</div>
            </div>
            <div>
              <div className="eq-detail__field-label">Due Date</div>
              <div className="eq-detail__field-value">{formatDate(request.due_date)}</div>
            </div>
            <div>
              <div className="eq-detail__field-label">Department</div>
              <div className="eq-detail__field-value">{request.hire_department}</div>
            </div>
            <div>
              <div className="eq-detail__field-label">Requestor</div>
              <div className="eq-detail__field-value">{request.requestor_name}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="eq-detail__field-label">Items</div>
              <div className="eq-detail__chips" style={{ marginTop: '0.375rem' }}>
                {(request.items || []).map(item => (
                  <span key={item} className="eq-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{ITEM_ICONS[item] || 'devices'}</span>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {request.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="eq-detail__field-label">Notes</div>
                <div className="eq-detail__field-value" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>{request.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="eq-detail__card">
        <div className="eq-detail__card-title">Audit Trail</div>
        <div className="eq-timeline">
          {events.map(ev => (
            <div key={ev.id} className="eq-event">
              <div className={`eq-event__dot eq-event__dot--${ev.event_type}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                  {EVENT_ICONS[ev.event_type] || 'info'}
                </span>
              </div>
              <div className="eq-event__body">
                <div className="eq-event__detail">{ev.detail}</div>
                <div className="eq-event__meta">{ev.user_name} · {formatDateTime(ev.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        <form className="eq-comment-form" onSubmit={submitComment} style={{ marginTop: events.length ? '1rem' : 0 }}>
          <textarea
            className="form-input"
            placeholder="Add a note or comment…"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={posting || !comment.trim()}>
            {posting ? '…' : 'Add note'}
          </button>
        </form>
      </div>
    </div>
  );
}
