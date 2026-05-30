import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api.js';
import TicketModal from './TicketModal.jsx';
import './Tickets.css';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '' });

  const loadTickets = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    api.get('/tickets', { params })
      .then(res => setTickets(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  function openCreate() { setSelected(null); setShowModal(true); }
  function openEdit(ticket) { setSelected(ticket); setShowModal(true); }
  function onSaved() { setShowModal(false); loadTickets(); }

  return (
    <div className="tickets-page">
      <div className="tickets-toolbar">
        <div className="tickets-toolbar__filters">
          <select
            className="form-select filter-select"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            className="form-select filter-select"
            value={filters.priority}
            onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <button className="btn btn--primary" onClick={openCreate}>
          + New Ticket
        </button>
      </div>

      {loading ? (
        <div className="tickets-state">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="tickets-state tickets-state--empty">
          <p>No tickets match your filters.</p>
          <button className="btn btn--primary" onClick={openCreate}>
            Create first ticket
          </button>
        </div>
      ) : (
        <div className="tickets-table-wrap">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created by</th>
                <th>Assigned to</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id}>
                  <td className="tickets-table__title">{ticket.title}</td>
                  <td>
                    <span className={`badge badge--${ticket.status}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge--${ticket.priority}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td>{ticket.creator_name}</td>
                  <td>{ticket.assignee_name ?? '—'}</td>
                  <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => openEdit(ticket)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TicketModal
          ticket={selected}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
