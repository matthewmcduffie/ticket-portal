import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard user={user} />;
  return <UserDashboard user={user} />;
}

// ─────────────────────────────────────────────────────────────
// USER DASHBOARD
// ─────────────────────────────────────────────────────────────
function UserDashboard({ user }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/tickets?limit=100')
      .then(r => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function closeTicket(id, e) {
    e.stopPropagation();
    await api.patch(`/tickets/${id}`, { status: 'closed' });
    load();
  }

  function toggleTrail(id, e) {
    e.stopPropagation();
    setExpandedId(prev => (prev === id ? null : id));
  }

  const stats = {
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
    total:       tickets.length,
  };

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Welcome back, {user?.name}</h2>
        <p className="dashboard__welcome-sub">Track and manage your support tickets below.</p>
      </div>

      <div className="dashboard__stats">
        <StatCard label="Open"        value={stats.open}        mod="warning" />
        <StatCard label="In Progress" value={stats.in_progress} mod="info"    />
        <StatCard label="Resolved"    value={stats.resolved}    mod="success" />
        <StatCard label="Total"       value={stats.total}       mod="default" />
      </div>

      <div className="dashboard__panel">
        <div className="dashboard__panel-header">
          <h3>My Tickets</h3>
          <Link to="/tickets" className="dashboard__action-link">
            <span className="material-symbols-outlined">add</span>
            New Ticket
          </Link>
        </div>

        {loading ? (
          <div className="dashboard__empty">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="dashboard__empty">You have no tickets yet.</div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Opened</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <React.Fragment key={ticket.id}>
                  <tr
                    className={`dash-table__row${expandedId === ticket.id ? ' dash-table__row--expanded' : ''}`}
                    onClick={e => toggleTrail(ticket.id, e)}
                  >
                    <td className="dash-table__id">#{ticket.id.slice(0, 6).toUpperCase()}</td>
                    <td className="dash-table__title">{ticket.title}</td>
                    <td>
                      <span className={`badge badge--status badge--${ticket.status}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge--${ticket.priority}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="dash-table__date">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="dash-table__actions" onClick={e => e.stopPropagation()}>
                      {!['closed', 'resolved'].includes(ticket.status) && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={e => closeTicket(ticket.id, e)}
                        >
                          Close
                        </button>
                      )}
                      <button
                        className={`btn btn--sm ${expandedId === ticket.id ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={e => toggleTrail(ticket.id, e)}
                        title="View activity trail"
                      >
                        <span className="material-symbols-outlined">history</span>
                        Trail
                      </button>
                    </td>
                  </tr>

                  {expandedId === ticket.id && (
                    <tr className="trail-row">
                      <td colSpan={6}>
                        <TicketTrail ticketId={ticket.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
function AdminDashboard({ user }) {
  const [tickets, setTickets] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/tickets?limit=100'),
      api.get('/tickets/activity'),
    ])
      .then(([tRes, aRes]) => {
        setTickets(tRes.data);
        setActivity(aRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total:       tickets.length,
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Welcome back, {user?.name}</h2>
        <p className="dashboard__welcome-sub">Support queue overview.</p>
      </div>

      <div className="dashboard__stats">
        <StatCard label="Total Tickets" value={stats.total}       mod="default" />
        <StatCard label="Open"          value={stats.open}        mod="warning" />
        <StatCard label="In Progress"   value={stats.in_progress} mod="info"    />
        <StatCard label="Resolved"      value={stats.resolved}    mod="success" />
      </div>

      <div className="dashboard__two-col">
        {/* Recent tickets */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3>Recent Tickets</h3>
            <Link to="/tickets" className="dashboard__action-link">View all →</Link>
          </div>

          {loading ? (
            <div className="dashboard__empty">Loading…</div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 8).map(ticket => (
                  <React.Fragment key={ticket.id}>
                    <tr
                      className={`dash-table__row${expandedId === ticket.id ? ' dash-table__row--expanded' : ''}`}
                      onClick={() => setExpandedId(p => p === ticket.id ? null : ticket.id)}
                    >
                      <td className="dash-table__title">{ticket.title}</td>
                      <td>
                        <span className={`badge badge--status badge--${ticket.status}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge--${ticket.priority}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className="material-symbols-outlined dash-table__expand-icon">
                          {expandedId === ticket.id ? 'expand_less' : 'expand_more'}
                        </span>
                      </td>
                    </tr>
                    {expandedId === ticket.id && (
                      <tr className="trail-row">
                        <td colSpan={4}>
                          <TicketTrail ticketId={ticket.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent activity feed */}
        <div className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h3>Recent Activity</h3>
          </div>
          {loading ? (
            <div className="dashboard__empty">Loading…</div>
          ) : activity.length === 0 ? (
            <div className="dashboard__empty">No activity yet.</div>
          ) : (
            <div className="activity-feed">
              {activity.map(ev => (
                <div key={ev.id} className="activity-item">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, mod }) {
  return (
    <div className={`stat-card stat-card--${mod}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}

function TicketTrail({ ticketId }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    api.get(`/tickets/${ticketId}/events`)
      .then(r => setEvents(r.data))
      .catch(() => setEvents([]));
  }, [ticketId]);

  if (events === null) return <div className="trail-loading">Loading trail…</div>;
  if (events.length === 0) return <div className="trail-loading">No activity recorded.</div>;

  return (
    <div className="trail">
      <div className="trail__heading">Activity Trail</div>
      <div className="trail__timeline">
        {events.map((ev, i) => (
          <div key={ev.id} className="trail__event">
            <div className="trail__line-wrap">
              <div className={`trail__dot trail__dot--${ev.event_type}`} />
              {i < events.length - 1 && <div className="trail__line" />}
            </div>
            <div className="trail__content">
              <div className="trail__detail">{ev.detail}</div>
              <div className="trail__meta">
                <span className="material-symbols-outlined trail__meta-icon">person</span>
                {ev.user_name}
                <span className="trail__sep">·</span>
                {new Date(ev.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
