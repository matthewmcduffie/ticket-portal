import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Login.css';

export default function Login() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">Tickets</h1>
          <p className="login-card__subtitle">Sign in to your account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-form__error" role="alert">{error}</div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              className="form-input"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              className="form-input"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            className="btn btn--primary login-form__submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
