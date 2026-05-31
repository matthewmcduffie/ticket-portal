import React, { useEffect, useState } from 'react';
import api from '../../services/api.js';
import './Analytics.css';

const PRIORITY_ORDER  = ['critical', 'high', 'medium', 'low'];
const PRIORITY_COLOR  = { critical: '#E53E3E', high: '#ED8936', medium: '#ECC94B', low: '#48BB78' };

function fmtHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1)   return `${Math.round(h * 60)} min`;
  if (h < 24)  return `${h.toFixed(1)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

function fmtSlaTarget(h) {
  if (h < 24)  return `${h}h`;
  return `${h / 24}d`;
}

export default function Analytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => setData(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="analytics-state">Loading analytics…</div>;
  if (error)   return <div className="analytics-state analytics-state--error">Failed to load: {error}</div>;

  const { volume, avg_resolution_hours, overall_sla_rate, by_priority, daily_volume, aging } = data;

  // Daily chart max
  const maxDaily = Math.max(...daily_volume.map(d => d.count), 1);

  // Aging total for bar widths
  const agingTotal = aging.reduce((s, a) => s + a.count, 0) || 1;

  // Merge by_priority into sorted order, filling missing priorities
  const priorityMap = Object.fromEntries(by_priority.map(r => [r.priority, r]));
  const priorityRows = PRIORITY_ORDER.map(p => priorityMap[p] || {
    priority: p, total: 0, resolved: 0, avg_hours: null, within_sla: 0,
    sla_target_hours: { critical: 4, high: 24, medium: 72, low: 168 }[p], sla_rate: null,
  });

  return (
    <div className="analytics">

      {/* ── Top KPIs ── */}
      <div className="analytics__kpis">
        <KpiCard label="Total Tickets"    value={volume.total}      sub={`${volume.today} today · ${volume.this_week} this week`} />
        <KpiCard label="Open"             value={volume.open}       sub={`${volume.in_progress} in progress`} accent="warning" />
        <KpiCard label="Avg Resolution"   value={fmtHours(avg_resolution_hours)} sub="across resolved tickets" />
        <KpiCard
          label="SLA Compliance"
          value={overall_sla_rate !== null ? `${overall_sla_rate}%` : '—'}
          sub="tickets resolved within target"
          accent={overall_sla_rate >= 80 ? 'success' : overall_sla_rate >= 60 ? 'warning' : 'danger'}
        />
      </div>

      {/* ── Volume + Aging ── */}
      <div className="analytics__two-col">

        {/* Daily volume bar chart */}
        <div className="analytics__panel">
          <div className="analytics__panel-header">
            <h3>Ticket Volume</h3>
            <span className="analytics__panel-sub">Last 14 days</span>
          </div>
          <div className="bar-chart">
            {daily_volume.map(d => (
              <div key={d.date} className="bar-chart__col">
                <div className="bar-chart__bar-wrap">
                  <div
                    className="bar-chart__bar"
                    style={{ height: `${Math.max((d.count / maxDaily) * 100, d.count > 0 ? 4 : 0)}%` }}
                    title={`${d.count} ticket${d.count !== 1 ? 's' : ''}`}
                  >
                    {d.count > 0 && <span className="bar-chart__tip">{d.count}</span>}
                  </div>
                </div>
                <span className="bar-chart__label">
                  {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Open ticket aging */}
        <div className="analytics__panel">
          <div className="analytics__panel-header">
            <h3>Open Ticket Age</h3>
            <span className="analytics__panel-sub">{volume.open + volume.in_progress} unresolved</span>
          </div>
          {aging.length === 0 ? (
            <div className="analytics__empty">No open tickets.</div>
          ) : (
            <div className="aging-chart">
              {aging.map(a => (
                <div key={a.range} className="aging-row">
                  <div className="aging-row__label">{a.range}</div>
                  <div className="aging-row__track">
                    <div
                      className="aging-row__fill"
                      style={{ width: `${Math.max((a.count / agingTotal) * 100, 2)}%` }}
                    />
                  </div>
                  <div className="aging-row__count">{a.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Priority breakdown table ── */}
      <div className="analytics__panel">
        <div className="analytics__panel-header">
          <h3>Resolution by Priority</h3>
          <span className="analytics__panel-sub">SLA targets: critical 4h · high 24h · medium 72h · low 7d</span>
        </div>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Total</th>
                <th>Resolved</th>
                <th>Avg Resolution</th>
                <th>SLA Target</th>
                <th>SLA Rate</th>
                <th>SLA Performance</th>
              </tr>
            </thead>
            <tbody>
              {priorityRows.map(r => (
                <tr key={r.priority}>
                  <td>
                    <span className={`badge badge--${r.priority}`}>{r.priority}</span>
                  </td>
                  <td className="analytics-table__num">{r.total}</td>
                  <td className="analytics-table__num">{r.resolved}</td>
                  <td className="analytics-table__num">{fmtHours(r.avg_hours)}</td>
                  <td className="analytics-table__num">{fmtSlaTarget(r.sla_target_hours)}</td>
                  <td className="analytics-table__num">
                    {r.sla_rate !== null ? (
                      <span className={`sla-rate ${r.sla_rate >= 80 ? 'sla-rate--good' : r.sla_rate >= 60 ? 'sla-rate--warn' : 'sla-rate--bad'}`}>
                        {r.sla_rate}%
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {r.resolved > 0 ? (
                      <div className="sla-bar-track">
                        <div
                          className={`sla-bar-fill ${r.sla_rate >= 80 ? 'sla-bar-fill--good' : r.sla_rate >= 60 ? 'sla-bar-fill--warn' : 'sla-bar-fill--bad'}`}
                          style={{ width: `${r.sla_rate ?? 0}%` }}
                        />
                      </div>
                    ) : <span className="analytics-table__na">No data</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Volume summary strip ── */}
      <div className="analytics__panel">
        <div className="analytics__panel-header">
          <h3>Volume Breakdown</h3>
        </div>
        <div className="volume-strip">
          {[
            { label: 'Open',        value: volume.open,        color: '#d97706' },
            { label: 'In Progress', value: volume.in_progress, color: '#0284c7' },
            { label: 'Resolved',    value: volume.resolved,    color: '#16a34a' },
            { label: 'Closed',      value: volume.closed,      color: '#64748b' },
          ].map(s => (
            <div key={s.label} className="volume-strip__item">
              <div className="volume-strip__bar" style={{ backgroundColor: s.color, width: `${Math.max((s.value / (volume.total || 1)) * 100, 2)}%` }} />
              <div className="volume-strip__label">{s.label}</div>
              <div className="volume-strip__count">{s.value}</div>
              <div className="volume-strip__pct">
                {volume.total > 0 ? `${Math.round((s.value / volume.total) * 100)}%` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`kpi-card${accent ? ` kpi-card--${accent}` : ''}`}>
      <div className="kpi-card__label">{label}</div>
      <div className="kpi-card__value">{value}</div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  );
}
