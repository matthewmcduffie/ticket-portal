import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Equipment.css';

const EQUIPMENT_ITEMS = [
  { id: 'laptop',   label: 'Laptop',   icon: 'laptop_mac' },
  { id: 'monitor',  label: 'Monitor',  icon: 'monitor' },
  { id: 'keyboard', label: 'Keyboard', icon: 'keyboard' },
  { id: 'mouse',    label: 'Mouse',    icon: 'mouse' },
];

export default function EquipmentNewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    hire_name: '',
    hire_department: '',
    hire_start_date: '',
    requestor_name: user?.name || user?.email || '',
    items: [],
    due_date: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard', { replace: true }); }
  }, [user, navigate]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function toggleItem(item) {
    setForm(f => ({
      ...f,
      items: f.items.includes(item)
        ? f.items.filter(i => i !== item)
        : [...f.items, item],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.hire_name.trim() || !form.hire_department.trim() || !form.hire_start_date ||
        !form.requestor_name.trim() || !form.due_date) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.items.length === 0) {
      setError('Please select at least one item.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/equipment', form);
      navigate(`/equipment/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create request.');
      setSaving(false);
    }
  }

  return (
    <div className="eq-form-page">
      <button className="eq-form-page__back" onClick={() => navigate('/equipment')}>
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
        Back to Equipment Requests
      </button>

      <h1 className="eq-form-page__title">New Equipment Request</h1>
      <p className="eq-form-page__sub">Fill in the new hire's details and select the equipment needed.</p>

      <form className="eq-form" onSubmit={handleSubmit}>
        <div className="eq-form__section">
          <div className="eq-form__section-title">New Hire Info</div>
          <div className="eq-form__row">
            <div className="eq-form__field">
              <label className="eq-form__label eq-form__label--required">Full Name</label>
              <input
                className="form-input"
                placeholder="Jane Smith"
                value={form.hire_name}
                onChange={e => set('hire_name', e.target.value)}
              />
            </div>
            <div className="eq-form__field">
              <label className="eq-form__label eq-form__label--required">Department</label>
              <input
                className="form-input"
                placeholder="Engineering"
                value={form.hire_department}
                onChange={e => set('hire_department', e.target.value)}
              />
            </div>
            <div className="eq-form__field">
              <label className="eq-form__label eq-form__label--required">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.hire_start_date}
                onChange={e => set('hire_start_date', e.target.value)}
              />
            </div>
            <div className="eq-form__field">
              <label className="eq-form__label eq-form__label--required">Requestor Name</label>
              <input
                className="form-input"
                placeholder="Your name"
                value={form.requestor_name}
                onChange={e => set('requestor_name', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="eq-form__section">
          <div className="eq-form__section-title">Equipment</div>
          <div className="eq-form__field">
            <label className="eq-form__label eq-form__label--required">Items Needed</label>
            <div className="eq-items">
              {EQUIPMENT_ITEMS.map(item => (
                <label
                  key={item.id}
                  className={`eq-item-check${form.items.includes(item.label) ? ' eq-item-check--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form.items.includes(item.label)}
                    onChange={() => toggleItem(item.label)}
                  />
                  <span className="material-symbols-outlined eq-item-check__icon">{item.icon}</span>
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="eq-form__field" style={{ marginTop: '1rem' }}>
            <label className="eq-form__label eq-form__label--required">Due Date</label>
            <input
              type="date"
              className="form-input"
              style={{ maxWidth: '220px' }}
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
            />
          </div>
        </div>

        <div className="eq-form__section">
          <div className="eq-form__section-title">Notes</div>
          <div className="eq-form__field">
            <label className="eq-form__label">Additional notes (optional)</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Any special requirements or notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        {error && <p className="eq-form__error">{error}</p>}

        <div className="eq-form__actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/equipment')}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
