import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './UsersPage.css';

const PER_PAGE_OPTIONS = [10, 50, 100];
const ROLES = ['user', 'technician', 'admin'];

// ── Three-dot action menu ──────────────────────────────────
function ActionMenu({ u, currentUserId, onEdit, onToggleActive, onUnlock, onReset, onDeleteClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isSelf = u.id === currentUserId;

  function act(fn) { setOpen(false); fn(); }

  return (
    <div className="action-menu" ref={ref}>
      <button
        className="action-menu__trigger btn btn--sm btn--ghost"
        onClick={() => setOpen(o => !o)}
        aria-label="User actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
      {open && (
        <div className="action-menu__dropdown" role="menu">
          <button className="action-menu__item" role="menuitem" onClick={() => act(onEdit)}>
            <span className="material-symbols-outlined">edit</span> Edit
          </button>
          {!isSelf && (
            <button className="action-menu__item" role="menuitem" onClick={() => act(onToggleActive)}>
              <span className="material-symbols-outlined">{u.active ? 'block' : 'check_circle'}</span>
              {u.active ? 'Deactivate' : 'Activate'}
            </button>
          )}
          <button className="action-menu__item" role="menuitem" onClick={() => act(onUnlock)}>
            <span className="material-symbols-outlined">lock_open</span> Unlock account
          </button>
          <button className="action-menu__item" role="menuitem" onClick={() => act(onReset)}>
            <span className="material-symbols-outlined">mail</span> Send reset email
          </button>
          {!isSelf && (
            <>
              <div className="action-menu__sep" />
              <button className="action-menu__item action-menu__item--danger" role="menuitem" onClick={() => act(onDeleteClick)}>
                <span className="material-symbols-outlined">delete</span> Delete user
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────
function EditUserModal({ target, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                 target.name,
    email:                target.email,
    role:                 target.role,
    can_view_bug_reports: !!target.can_view_bug_reports,
    can_use_projects:     !!target.can_use_projects,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const isSelf        = target.id === currentUserId;
  const showPermFlags = form.role === 'user';

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.patch(`/users/${target.id}`, form);
      onSaved(`${form.name} updated.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="umodal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="umodal" role="dialog" aria-modal="true" aria-label={`Edit ${target.name}`}>
        <div className="umodal__header">
          <h3 className="umodal__title">Edit user</h3>
          <button className="umodal__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form className="umodal__body" onSubmit={handleSave}>
          {error && <div className="users-alert users-alert--error">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="eu-name">Full name</label>
            <input id="eu-name" name="name" className="form-input" value={form.name} onChange={handleChange} required autoFocus />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="eu-email">Email address</label>
            <input id="eu-email" name="email" type="email" className="form-input" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="eu-role">Role</label>
            <select id="eu-role" name="role" className="form-select" value={form.role} onChange={handleChange} disabled={isSelf}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            {isSelf && <p className="umodal__hint">You cannot change your own role.</p>}
          </div>

          {showPermFlags && (
            <>
              <label className="drawer-toggle">
                <input type="checkbox" name="can_view_bug_reports" className="drawer-toggle__check" checked={form.can_view_bug_reports} onChange={handleChange} />
                <div className="drawer-toggle__info">
                  <div className="drawer-toggle__label">Can view bug reports</div>
                  <div className="drawer-toggle__desc">Shows the Bug Tracker and allows access to bug report records.</div>
                </div>
              </label>
              <label className="drawer-toggle">
                <input type="checkbox" name="can_use_projects" className="drawer-toggle__check" checked={form.can_use_projects} onChange={handleChange} />
                <div className="drawer-toggle__info">
                  <div className="drawer-toggle__label">Can use Projects</div>
                  <div className="drawer-toggle__desc">Shows the Projects link and allows the user to create and manage projects.</div>
                </div>
              </label>
            </>
          )}

          <div className="umodal__footer">
            <div className="umodal__footer-right">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────
function DeleteModal({ target, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  async function confirm() {
    setDeleting(true);
    try {
      await api.delete(`/users/${target.id}`);
      onDeleted(`${target.name} has been deleted.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
      setDeleting(false);
    }
  }

  return (
    <div className="umodal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="umodal umodal--sm" role="dialog" aria-modal="true">
        <div className="umodal__header">
          <h3 className="umodal__title">Delete user</h3>
          <button className="umodal__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="umodal__body">
          {error && <div className="users-alert users-alert--error">{error}</div>}
          <p className="umodal__del-msg">
            Permanently delete <strong>{target.name}</strong> ({target.email})?
            This cannot be undone.
          </p>
          <div className="umodal__footer">
            <div className="umodal__footer-right">
              <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn--danger" onClick={confirm} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Import section ─────────────────────────────────────────
function ImportSection({ onImported }) {
  const [file,      setFile]      = useState(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const inputRef = useRef(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/users/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="import-section">
      <div className="import-section__desc">
        Upload a CSV or Excel file. <strong>Column A: Name</strong> · <strong>Column B: Email.</strong>{' '}
        Duplicate emails are skipped. Each new user receives an invite email to set their password.
      </div>
      <div className="import-section__controls">
        <label className="import-section__file-btn">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files[0] || null); setResult(null); setError(''); }}
          />
          <span className="material-symbols-outlined">upload_file</span>
          {file ? file.name : 'Choose file…'}
        </label>
        <button className="btn btn--primary" onClick={handleImport} disabled={!file || importing}>
          {importing ? 'Importing…' : 'Import users'}
        </button>
      </div>
      {result && (
        <div className="users-alert users-alert--success">
          Import complete — {result.created} user{result.created !== 1 ? 's' : ''} created
          {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
        </div>
      )}
      {error && <div className="users-alert users-alert--error">{error}</div>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin       = user?.role === 'admin';
  const isTechnician  = user?.role === 'technician';

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [perPage,   setPerPage]   = useState(10);
  const [page,      setPage]      = useState(1);
  const [actionMsg, setActionMsg] = useState('');
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Create form state
  const [form,          setForm]          = useState({ name: '', email: '', role: 'user', password: '', can_view_bug_reports: false, can_use_projects: false });
  const [setPasswordOn, setSetPasswordOn] = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

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

  const showPermFlags = form.role === 'user';

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);
    try {
      const payload = { ...form, set_password: setPasswordOn };
      if (!setPasswordOn) delete payload.password;
      await api.post('/users', payload);
      setForm({ name: '', email: '', role: 'user', password: '', can_view_bug_reports: false, can_use_projects: false });
      setSetPasswordOn(false);
      setCreateSuccess(
        setPasswordOn
          ? 'User created. They can log in with the password you set.'
          : 'User created. An invite email has been sent.'
      );
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
      flash(`${u.name} ${u.active ? 'deactivated' : 'activated'}.`);
      load();
    } catch (err) { console.error(err); }
  }

  async function unlockUser(u) {
    try {
      await api.post(`/users/${u.id}/unlock`);
      flash(`${u.name}'s account has been unlocked.`);
    } catch (err) { console.error(err); }
  }

  async function sendReset(u) {
    try {
      await api.post(`/users/${u.id}/send-reset`);
      flash(`Password reset email sent to ${u.email}.`);
    } catch (err) {
      flash('Failed to send reset email. Check your AgentMail configuration.');
    }
  }

  function flash(msg, ms = 4000) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), ms);
  }

  function onEditSaved(msg) { setEditTarget(null); flash(msg); load(); }
  function onDeleted(msg)   { setDeleteTarget(null); flash(msg); load(); }

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

      {editTarget && (
        <EditUserModal target={editTarget} currentUserId={user.id} onClose={() => setEditTarget(null)} onSaved={onEditSaved} />
      )}
      {deleteTarget && (
        <DeleteModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={onDeleted} />
      )}

      {/* Create user — admins only */}
      {isAdmin && (
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
                <input id="cu-email" name="email" type="email" className="form-input" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="cu-role">Role</label>
                <select id="cu-role" name="role" className="form-select" value={form.role} onChange={handleChange}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <label className="drawer-toggle">
              <input
                type="checkbox"
                className="drawer-toggle__check"
                checked={setPasswordOn}
                onChange={e => setSetPasswordOn(e.target.checked)}
              />
              <div className="drawer-toggle__info">
                <div className="drawer-toggle__label">Set a password for this user</div>
                <div className="drawer-toggle__desc">
                  By default the user receives an email invite to set their own password.
                  Check this to assign a password yourself instead.
                </div>
              </div>
            </label>

            {setPasswordOn && (
              <div className="form-field">
                <label className="form-label" htmlFor="cu-password">Password</label>
                <input id="cu-password" name="password" type="password" className="form-input" value={form.password} onChange={handleChange} required={setPasswordOn} />
              </div>
            )}

            {showPermFlags && (
              <>
                <label className="drawer-toggle">
                  <input type="checkbox" name="can_view_bug_reports" className="drawer-toggle__check" checked={form.can_view_bug_reports} onChange={handleChange} />
                  <div className="drawer-toggle__info">
                    <div className="drawer-toggle__label">Allow bug report access</div>
                    <div className="drawer-toggle__desc">Shows the Bug Tracker and allows access to bug reports.</div>
                  </div>
                </label>
                <label className="drawer-toggle">
                  <input type="checkbox" name="can_use_projects" className="drawer-toggle__check" checked={form.can_use_projects} onChange={handleChange} />
                  <div className="drawer-toggle__info">
                    <div className="drawer-toggle__label">Allow Projects access</div>
                    <div className="drawer-toggle__desc">Shows the Projects link and allows the user to create and join projects.</div>
                  </div>
                </label>
              </>
            )}

            <div className="users-create-form__footer">
              <button className="btn btn--primary" type="submit" disabled={creating}>
                <span className="material-symbols-outlined">person_add</span>
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Import — admins only */}
      {isAdmin && (
        <section className="users-section">
          <div className="users-section__header">
            <h3>Import Users</h3>
            <p className="users-section__desc">Bulk-add users from a CSV or Excel spreadsheet.</p>
          </div>
          <div className="users-create-form">
            <ImportSection onImported={load} />
          </div>
        </section>
      )}

      {/* User list */}
      <section className="users-section">
        {actionMsg && <div className="users-alert users-alert--success" style={{ margin: '1rem 1.5rem 0' }}>{actionMsg}</div>}
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
                  {isAdmin && <th style={{ width: '2.5rem' }}></th>}
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
                    <td>
                      <span className={`badge role-badge role-badge--${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge badge--status badge--${u.active ? 'resolved' : 'closed'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="settings-table__date">{new Date(u.created_at).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="users-actions-cell">
                        <ActionMenu
                          u={u}
                          currentUserId={user.id}
                          onEdit={() => setEditTarget(u)}
                          onToggleActive={() => toggleActive(u)}
                          onUnlock={() => unlockUser(u)}
                          onReset={() => sendReset(u)}
                          onDeleteClick={() => setDeleteTarget(u)}
                        />
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
