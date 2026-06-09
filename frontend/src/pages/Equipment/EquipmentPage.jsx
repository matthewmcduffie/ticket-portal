import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import Tooltip from '../../components/Tooltip/Tooltip.jsx';
import './Equipment.css';

const EQ_STATUS_TIP = {
  pending:   'Pending — submitted, not yet reviewed.',
  approved:  'Approved — cleared for fulfillment.',
  fulfilled: 'Fulfilled — equipment delivered.',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EquipmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard', { replace: true }); return; }
    api.get('/equipment')
      .then(r => setRequests(r.data))
      .catch(() => setError('Failed to load equipment requests.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) return <div className="eq-loading">Loading…</div>;
  if (error)   return <div className="eq-error">{error}</div>;

  return (
    <div className="eq-page">
      <div className="eq-page__header">
        <div>
          <h1 className="eq-page__title">Equipment Requests</h1>
          <p className="eq-page__sub">Manage new hire equipment provisioning.</p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/equipment/new')}>
          <span className="material-symbols-outlined">add</span>
          New Request
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="eq-empty">
          <div className="eq-empty__icon">
            <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>devices</span>
          </div>
          <p className="eq-empty__text">No equipment requests yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="eq-list">
          {requests.map(req => (
            <button key={req.id} className="eq-row" onClick={() => navigate(`/equipment/${req.id}`)}>
              <div>
                <div className="eq-row__name">{req.hire_name}</div>
                <div className="eq-row__meta">{req.hire_department} · Requestor: {req.requestor_name}</div>
              </div>
              <div className="eq-row__items">
                {(req.items || []).join(', ') || '—'}
              </div>
              <div className="eq-row__due">Due {formatDate(req.due_date)}</div>
              <Tooltip text={EQ_STATUS_TIP[req.status]} position="top">
                <span className={`eq-badge eq-badge--${req.status}`}>{req.status}</span>
              </Tooltip>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
