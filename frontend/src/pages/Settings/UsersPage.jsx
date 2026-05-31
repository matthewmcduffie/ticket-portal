import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './UsersPage.css';

const PER_PAGE_OPTIONS = [10, 50, 100];

export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [perPage,   setPerPage]   = useState(10);
  const [page,      setPage]      = useState(1);

  const [form,          setForm]          = useState({ name: '', email: '', password: '', role: 'user' });
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [actionMsg,     setActionMsg]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users')
      .then(r => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, perPage]);

  const filtered   = users.filter(u => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageUsers  = filtered.slice((page - 1) * perPage, page * perPage);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);
    try {
      await api.post('/users', form);
      setForm({ name: '', email: '', password: '', role: 'user' });
      setCreateSuccess('User created successfully.');
      load();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u) {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      load();
    } catch (err) { console.error(err); }
  }

  async function unlockUser(u) {
    try {
      await api.post(`/users/${u.id}/unlock`);
      setActionMsg(`${u.name}'s account has been unlocked.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) { console.error(err); }
  }

  async function sendReset(u) {
    try {
      await api.post(`/users/${u.id}/send-reset`);
      setActionMsg(`Password reset email sent to ${u.email}.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      setActionMsg('Failed to send reset email. Check your AgentMail configuration.');
      setTimeout(() => setActionMsg(''), 5000);
    }
  }

  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, page]);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.add(i);
    return [...pages].sort((a, b) => a - b).reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);
  }

  return (
    <div className="users-page">

      {/* Create user */}
      <section className="users-section">
        <div className="users-section__header">
          <h3>Create User</h3>
          <p className="users-section__desc">Add a new account to the portal.</p>
        </div>

        <form className="users-create-form" onSubmit={handleCreate}>
          {createError   && <div className="users-alert users-alert--error">{createError}</div>}
          {createSuccess && <div className="users-alert users-alert--success">{createSuccess}</div>}

          <div className="users-create-form__grid">
            <div className="form-field">
              <label className="form-label" htmlFor="cu-name">Full name</label>
              <input id="cu-name" name="name" className="form-input" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="cu-email">Email address</label>
              <input id="cu-email" name="email" className="form-input" type="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="cu-password">Password</label>
              <input id="cu-password" name="password" className="form-input" type="password" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="cu-role">Role</label>
              <select id="cu-role" name="role" className="form-select" value={form.role} onChange={handleChange}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="users-create-form__footer">
            <button className="btn btn--primary" type="submit" disabled={creating}>
              <span className="material-symbols-outlined">person_add</span>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </section>

      {/* User list */}
      <section className="users-section">
        {actionMsg && <div className="users-alert users-alert--success">{actionMsg}</div>}
        <div className="users-section__header">
          <h3>All Users</h3>
          <p className="users-section__desc">{users.length} total</p>
        </div>

        <div className="users-toolbar">
          <div className="settings-search">
            <span className="material-symbols-outlined settings-search__icon">search</span>
            <input
              className="settings-search__input"
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="settings-perpage">
            <span className="settings-perpage__label">Show</span>
            {PER_PAGE_OPTIONS.map(n => (
              <button
                key={n}
                className={`settings-perpage__btn${perPage === n ? ' settings-perpage__btn--active' : ''}`}
                onClick={() => setPerPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="users-empty">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="users-empty">{search ? `No users match "${search}".` : 'No users found.'}</div>
        ) : (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-cell__avatar">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="user-cell__info">
                          <div className="user-cell__name">{u.name}</div>
                          <div className="user-cell__email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge role-badge role-badge--${u.role}`}>{u.role}</span></td>
                    <td>
                      <span className={`badge badge--status badge--${u.active ? 'resolved' : 'closed'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="settings-table__date">{new Date(u.created_at).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="users-actions-cell">
                        {u.id !== user.id && (
                          <button
                            className={`btn btn--sm ${u.active ? 'btn--ghost' : 'btn--primary'}`}
                            onClick={() => toggleActive(u)}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button
                          className="btn btn--sm btn--ghost"
                          title="Unlock account (clears login lockout)"
                          onClick={() => unlockUser(u)}
                        >
                          Unlock
                        </button>
                        <button
                          className="btn btn--sm btn--ghost"
                          title="Email a password reset link"
                          onClick={() => sendReset(u)}
                        >
                          Send reset
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="settings-pagination">
            <span className="settings-pagination__info">
              {filtered.length} user{filtered.length !== 1 ? 's' : ''} — page {page} of {totalPages}
            </span>
            <div className="settings-pagination__controls">
              <button className="settings-pagination__btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {getPageNumbers().map((p, i) =>
                p === '…' ? (
                  <span key={`e-${i}`} className="settings-pagination__ellipsis">…</span>
                ) : (
                  <button key={p} className={`settings-pagination__btn${page === p ? ' settings-pagination__btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                )
              )}
              <button className="settings-pagination__btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
