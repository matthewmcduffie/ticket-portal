import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../services/api.js';
import TicketModal from './TicketModal.jsx';
import './Tickets.css';

const PER_PAGE_OPTIONS = [20, 50, 100];

export default function Tickets() {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew,  setShowNew]  = useState(false);

  // Filters / search / pagination
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [perPage,  setPerPage]  = useState(20);
  const [page,     setPage]     = useState(1);

  // Load all tickets client-side, filter/page locally
  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    api.get('/tickets?limit=500')
      .then(r => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Reset to page 1 on any filter change
  useEffect(() => { setPage(1); }, [search, status, priority, perPage]);

  // Derived filtered + paged list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return tickets.filter(t => {
      if (status   && t.status   !== status)   return false;
      if (priority && t.priority !== priority) return false;
      if (q) {
        const matchId      = t.id.slice(0, 6).toLowerCase().startsWith(q);
        const matchTitle   = t.title.toLowerCase().includes(q);
        const matchCreator = t.creator_name?.toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchCreator) return false;
      }
      return true;
    });
  }, [tickets, search, status, priority]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged      = filtered.slice((page - 1) * perPage, page * perPage);

  function onSaved() {
    setSelected(null);
    setShowNew(false);
    load();
  }

  const hasActiveFilters = search || status || priority;

  return (
    <div className="tickets-page">

      {/* ── Toolbar ── */}
      <div className="tickets-toolbar">
        {/* Search */}
        <div className="tickets-search">
          <span className="material-symbols-outlined tickets-search__icon">search</span>
          <input
            className="tickets-search__input"
            type="search"
            placeholder="Search by title, username, or #ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status */}
        <select
          className="filter-select"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        {/* Priority */}
        <select
          className="filter-select"
          value={priority}
          onChange={e => setPriority(e.target.value)}
        >
          <option value="">Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Per-page */}
        <div className="tickets-perpage">
          {PER_PAGE_OPTIONS.map(n => (
            <button
              key={n}
              className={`tickets-perpage__btn${perPage === n ? ' tickets-perpage__btn--active' : ''}`}
              onClick={() => setPerPage(n)}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            className="tickets-clear"
            onClick={() => { setSearch(''); setStatus(''); setPriority(''); }}
            title="Clear filters"
          >
            <span className="material-symbols-outlined">filter_list_off</span>
          </button>
        )}

        {/* New ticket — pushed right */}
        <button className="btn btn--primary tickets-toolbar__new" onClick={() => setShowNew(true)}>
          <span className="material-symbols-outlined">add</span>
          New Ticket
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="tickets-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="tickets-state tickets-state--empty">
          <p>{hasActiveFilters ? 'No tickets match your filters.' : 'No tickets yet.'}</p>
          {!hasActiveFilters && (
            <button className="btn btn--primary" onClick={() => setShowNew(true)}>Create first ticket</button>
          )}
          {hasActiveFilters && (
            <button className="btn btn--ghost" onClick={() => { setSearch(''); setStatus(''); setPriority(''); }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="tickets-table-wrap">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created by</th>
                  <th>Assigned to</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(ticket => (
                  <tr key={ticket.id} onClick={() => setSelected(ticket)}>
                    <td className="tickets-table__id">#{ticket.id.slice(0, 6).toUpperCase()}</td>
                    <td className="tickets-table__title">{ticket.title}</td>
                    <td>
                      <span className={`badge badge--status badge--${ticket.status}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge--${ticket.priority}`}>{ticket.priority}</span>
                    </td>
                    <td>{ticket.creator_name}</td>
                    <td>{ticket.assignee_name ?? '—'}</td>
                    <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="tickets-pagination">
            <span className="tickets-pagination__info">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
              {hasActiveFilters ? ' match' : ''}
              {totalPages > 1 && ` — showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)}`}
            </span>
            {totalPages > 1 && (
              <div className="tickets-pagination__controls">
                <button
                  className="tickets-pagination__btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="tickets-pagination__ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`tickets-pagination__btn${page === p ? ' tickets-pagination__btn--active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  className="tickets-pagination__btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {selected && (
        <TicketModal ticket={selected} onClose={() => setSelected(null)} onSaved={onSaved} />
      )}
      {showNew && (
        <TicketModal ticket={null} onClose={() => setShowNew(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

function getPageNumbers(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page]);
  for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.add(i);
  return [...pages].sort((a, b) => a - b).reduce((acc, p, i, arr) => {
    if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
    acc.push(p);
    return acc;
  }, []);
}
