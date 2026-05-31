import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import TicketModal from '../Tickets/TicketModal.jsx';
import api from '../../services/api.js';
import './Dashboard.css';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_PER_PAGE_OPTIONS = [6, 25, 100];

function isNew(t) {
  return Date.now() - new Date(t.created_at).getTime() < ONE_DAY_MS;
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard user={user} />;
  return <UserDashboard user={user} />;
}

// ─────────────────────────────────────────────────────────────
// USER DASHBOARD
// ─────────────────────────────────────────────────────────────
function UserDashboard({ user }) {
  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [activeFilter,  setActiveFilter]  = useState(null);

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    api.get('/tickets?limit=100')
      .then(r => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function closeTicket(id, e) {
    e.stopPropagation();
    await api.patch(`/tickets/${id}`, { status: 'closed' });
    load();
  }

  function handleCardClick(filter) {
    setActiveFilter(prev => prev === filter ? null : filter);
  }

  const stats = {
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
    total:       tickets.length,
  };

  const displayed = activeFilter
    ? tickets.filter(t => t.status === activeFilter)
    : tickets;

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Welcome back, {user?.name}</h2>
        <p className="dashboard__welcome-sub">Track and manage your support tickets below.</p>
      </div>

      <div className="dashboard__stats">
        <StatCard label="Open"        value={stats.open}        mod="warning" filter="open"        active={activeFilter} onClick={handleCardClick} />
        <StatCard label="In Progress" value={stats.in_progress} mod="info"    filter="in_progress" active={activeFilter} onClick={handleCardClick} />
        <StatCard label="Resolved"    value={stats.resolved}    mod="success" filter="resolved"    active={activeFilter} onClick={handleCardClick} />
        <StatCard label="Total"       value={stats.total}       mod="default" filter={null}        active={activeFilter} onClick={handleCardClick} />
      </div>

      <div className="dashboard__panel">
        <div className="dashboard__panel-header">
          <h3>
            {activeFilter ? `${activeFilter.replace('_', ' ')} tickets` : 'My Tickets'}
            {activeFilter && (
              <button className="dash-filter-clear" onClick={() => setActiveFilter(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </h3>
          <Link to="/tickets" className="dashboard__action-link">
            <span className="material-symbols-outlined">add</span>
            New Ticket
          </Link>
        </div>

        {loading ? (
          <div className="dashboard__empty">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="dashboard__empty">
            {activeFilter ? `No ${activeFilter.replace('_', ' ')} tickets.` : 'No tickets yet.'}
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Opened</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(ticket => (
                <tr key={ticket.id} className="dash-table__row" onClick={() => setSelected(ticket)}>
                  <td className="dash-table__title">
                    {isNew(ticket) && <span className="dash-new-badge">New</span>}
                    {ticket.title}
                  </td>
                  <td>
                    <span className={`badge badge--status badge--${ticket.status}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td><span className={`badge badge--${ticket.priority}`}>{ticket.priority}</span></td>
                  <td className="dash-table__date">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  <td className="dash-table__actions" onClick={e => e.stopPropagation()}>
                    {!['closed', 'resolved'].includes(ticket.status) && (
                      <button className="btn btn--ghost btn--sm" onClick={e => closeTicket(ticket.id, e)}>Close</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <TicketModal ticket={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
function AdminDashboard({ user }) {
  const [tickets,       setTickets]       = useState([]);
  const [activity,      setActivity]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [activeFilter,  setActiveFilter]  = useState(null);
  const [activityPerPage, setActivityPerPage] = useState(6);
  const [activityPage,    setActivityPage]    = useState(1);

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    Promise.all([
      api.get('/tickets?limit=100'),
      api.get('/tickets/activity?limit=100'),
    ])
      .then(([tRes, aRes]) => {
        setTickets(tRes.data);
        setActivity(aRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Reset activity page when per-page changes
  useEffect(() => { setActivityPage(1); }, [activityPerPage]);

  function handleCardClick(filter) {
    setActiveFilter(prev => prev === filter ? null : filter);
  }

  function openFromActivity(ev) {
    const ticket = tickets.find(t => t.id === ev.ticket_id);
    if (ticket) setSelected(ticket);
  }

  const stats = {
    total:       tickets.length,
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
  };

  const filteredTickets = activeFilter
    ? tickets.filter(t => t.status === activeFilter)
    : tickets.slice(0, 10);

  const totalActivityPages = Math.max(1, Math.ceil(activity.length / activityPerPage));
  const pagedActivity = activity.slice(
    (activityPage - 1) * activityPerPage,
    activityPage * activityPerPage
  );

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Welcome back, {user?.name}</h2>
        <p className="dashboard__welcome-sub">Support queue overview.</p>
      </div>

      <div className="dashboard__stats">
        <StatCard label="Total"       value={stats.total}       mod="default" filter={null}        active={activeFilter} onClick={handleCardClick} />
        <StatCard label="Open"        value={stats.open}        mod="warning" filter="open"        active={activeFilter} onClick={handleCardClick} />
        <StatCard label="In Progress" value={stats.in_progress} mod="info"    filter="in_progress" active={activeFilter} onClick={handleCardClick} />
        <StatCard label="Resolved"    value={stats.resolved}    mod="success" filter="resolved"    active={activeFilter} onClick={handleCardClick} />
      </div>

      <div className="dashboard__two-col">

        {/* Recent / Filtered Tickets */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3>
              {activeFilter ? `${activeFilter.replace('_', ' ')} tickets` : 'Recent Tickets'}
              {activeFilter && (
                <button className="dash-filter-clear" onClick={() => setActiveFilter(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </h3>
            {!activeFilter && <Link to="/tickets" className="dashboard__action-link">View all →</Link>}
          </div>

          {loading ? (
            <div className="dashboard__empty">Loading…</div>
          ) : filteredTickets.length === 0 ? (
            <div className="dashboard__empty">No {activeFilter?.replace('_', ' ')} tickets.</div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} className="dash-table__row" onClick={() => setSelected(ticket)}>
                    <td className="dash-table__title">
                      {isNew(ticket) && <span className="dash-new-badge">New</span>}
                      {ticket.title}
                    </td>
                    <td>
                      <span className={`badge badge--status badge--${ticket.status}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td><span className={`badge badge--${ticket.priority}`}>{ticket.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Activity with pagination */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3>Recent Activity</h3>
            <div className="activity-pagination">
              {ACTIVITY_PER_PAGE_OPTIONS.map(n => (
                <button
                  key={n}
                  className={`activity-perpage-btn${activityPerPage === n ? ' activity-perpage-btn--active' : ''}`}
                  onClick={() => setActivityPerPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className="activity-nav-btn"
                onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                disabled={activityPage === 1}
                aria-label="Previous"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="activity-page-info">{activityPage}/{totalActivityPages}</span>
              <button
                className="activity-nav-btn"
                onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                disabled={activityPage === totalActivityPages}
                aria-label="Next"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="dashboard__empty">Loading…</div>
          ) : pagedActivity.length === 0 ? (
            <div className="dashboard__empty">No activity yet.</div>
          ) : (
            <div className="activity-feed">
              {pagedActivity.map(ev => (
                <div
                  key={ev.id}
                  className="activity-item activity-item--clickable"
                  onClick={() => openFromActivity(ev)}
                >
                  <div className={`activity-item__dot activity-item__dot--${ev.event_type}`} />
                  <div className="activity-item__body">
                    <div className="activity-item__detail">{ev.detail}</div>
                    <div className="activity-item__meta">
                      <span className="activity-item__ticket">{ev.ticket_title}</span>
                      <span className="activity-item__sep">·</span>
                      <span>{ev.user_name}</span>
                      <span className="activity-item__sep">·</span>
                      <span>{timeAgo(ev.created_at)}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined activity-item__arrow">chevron_right</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {selected && (
        <TicketModal ticket={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, mod, filter, active, onClick }) {
  const isActive = active === filter || (filter === null && active === null);
  return (
    <button
      className={`stat-card stat-card--${mod}${isActive && active !== null ? ' stat-card--active' : ''}`}
      onClick={() => onClick(filter)}
    >
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {isActive && active !== null && (
        <div className="stat-card__filter-hint">filtering ↓</div>
      )}
    </button>
  );
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
