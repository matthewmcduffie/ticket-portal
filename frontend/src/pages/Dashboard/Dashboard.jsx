import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tickets?limit=100')
      .then(res => {
        const tickets = res.data;
        setStats({
          total:       tickets.length,
          open:        tickets.filter(t => t.status === 'open').length,
          in_progress: tickets.filter(t => t.status === 'in_progress').length,
          resolved:    tickets.filter(t => t.status === 'resolved').length,
        });
        setRecent(tickets.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="dashboard-loading">Loading…</div>;

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Welcome back, {user?.name}</h2>
        <p className="dashboard__welcome-sub">Here's an overview of your tickets.</p>
      </div>

      <div className="dashboard__stats">
        <StatCard label="Total" value={stats?.total ?? 0} mod="default" />
        <StatCard label="Open" value={stats?.open ?? 0} mod="warning" />
        <StatCard label="In Progress" value={stats?.in_progress ?? 0} mod="info" />
        <StatCard label="Resolved" value={stats?.resolved ?? 0} mod="success" />
      </div>

      <div className="dashboard__panel">
        <div className="dashboard__panel-header">
          <h3>Recent Tickets</h3>
          <Link to="/tickets" className="dashboard__view-all">View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="dashboard__empty">No tickets yet.</div>
        ) : (
          <div className="ticket-preview-list">
            {recent.map(t => (
              <div key={t.id} className="ticket-preview">
                <div className="ticket-preview__info">
                  <span className="ticket-preview__title">{t.title}</span>
                  <span className="ticket-preview__by">by {t.creator_name}</span>
                </div>
                <div className="ticket-preview__badges">
                  <span className={`badge badge--${t.status}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className={`badge badge--${t.priority}`}>
                    {t.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, mod }) {
  return (
    <div className={`stat-card stat-card--${mod}`}>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
