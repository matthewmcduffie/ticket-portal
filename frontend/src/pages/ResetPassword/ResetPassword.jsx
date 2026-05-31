import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import './ResetPassword.css';

const RULES = [
  { test: v => v.length >= 8,            label: 'At least 8 characters' },
  { test: v => /[A-Z]/.test(v),          label: 'One uppercase letter' },
  { test: v => /[0-9]/.test(v),          label: 'One number' },
  { test: v => /[^A-Za-z0-9]/.test(v),  label: 'One special character' },
];

export default function ResetPassword() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') || '';

  const [form, setForm]     = useState({ next: '', confirm: '' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    if (!token) setError('No reset token found. Please use the link from your email.');
  }, [token]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: form.next });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rp-page">
        <div className="rp-card">
          <div className="rp-card__brand">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <h1 className="rp-card__heading">Password updated</h1>
          <p className="rp-card__sub">Your password has been changed. You can sign in now.</p>
          <button className="btn btn--primary rp-form__submit" onClick={() => navigate('/login')}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-page">
      <div className="rp-card">
        <div className="rp-card__brand">
          <span className="material-symbols-outlined">lock_reset</span>
        </div>
        <h1 className="rp-card__heading">Set a new password</h1>
        <p className="rp-card__sub">This link expires in one hour.</p>

        <form className="rp-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="rp-form__error" role="alert">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="rp-next">New password</label>
            <input
              id="rp-next"
              name="next"
              type="password"
              className="form-input"
              value={form.next}
              onChange={handleChange}
              autoComplete="new-password"
              required
              disabled={!token}
              autoFocus
            />
            <ul className="rp-rules">
              {RULES.map(r => (
                <li key={r.label} className={`rp-rule ${r.test(form.next) ? 'rp-rule--ok' : ''}`}>
                  <span className="material-symbols-outlined">
                    {r.test(form.next) ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  {r.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="rp-confirm">Confirm new password</label>
            <input
              id="rp-confirm"
              name="confirm"
              type="password"
              className="form-input"
              value={form.confirm}
              onChange={handleChange}
              autoComplete="new-password"
              required
              disabled={!token}
            />
          </div>

          <button
            className="btn btn--primary rp-form__submit"
            type="submit"
            disabled={saving || !token}
          >
            {saving ? 'Saving…' : 'Set new password'}
          </button>
        </form>

        <button type="button" className="rp-login-link" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
