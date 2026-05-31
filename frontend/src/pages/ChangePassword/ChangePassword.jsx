import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './ChangePassword.css';

const RULES = [
  { test: v => v.length >= 8,            label: 'At least 8 characters' },
  { test: v => /[A-Z]/.test(v),          label: 'One uppercase letter' },
  { test: v => /[0-9]/.test(v),          label: 'One number' },
  { test: v => /[^A-Za-z0-9]/.test(v),  label: 'One special character' },
];

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isForced = user?.must_change_password;

  const [form, setForm]   = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current,
        new_password: form.next,
      });
      // Reload user (must_change_password is now false)
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-page">
      <div className="cp-card">
        <div className="cp-card__brand">
          <span className="material-symbols-outlined">lock_reset</span>
        </div>
        <h1 className="cp-card__heading">
          {isForced ? 'Create your password' : 'Change password'}
        </h1>
        {isForced && (
          <p className="cp-card__sub">
            Your account requires a new password before you can continue.
          </p>
        )}

        <form className="cp-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="cp-form__error" role="alert">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="cp-current">
              {isForced ? 'Temporary password' : 'Current password'}
            </label>
            <input
              id="cp-current"
              name="current"
              type="password"
              className="form-input"
              value={form.current}
              onChange={handleChange}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="cp-next">New password</label>
            <input
              id="cp-next"
              name="next"
              type="password"
              className="form-input"
              value={form.next}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            <ul className="cp-rules">
              {RULES.map(r => (
                <li key={r.label} className={`cp-rule ${r.test(form.next) ? 'cp-rule--ok' : ''}`}>
                  <span className="material-symbols-outlined">
                    {r.test(form.next) ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  {r.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="cp-confirm">Confirm new password</label>
            <input
              id="cp-confirm"
              name="confirm"
              type="password"
              className="form-input"
              value={form.confirm}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            className="btn btn--primary cp-form__submit"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Set new password'}
          </button>

          {!isForced && (
            <button
              type="button"
              className="btn btn--ghost cp-form__cancel"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          )}
        </form>

        {isForced && (
          <button type="button" className="cp-logout-link" onClick={logout}>
            Sign out instead
          </button>
        )}
      </div>
    </div>
  );
}
