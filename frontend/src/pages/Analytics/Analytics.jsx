import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api.js';
import Drawer from '../../components/Drawer/Drawer.jsx';
import TicketModal from '../Tickets/TicketModal.jsx';
import Tooltip from '../../components/Tooltip/Tooltip.jsx';
import './Analytics.css';

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const OPEN_STATUSES = new Set(['open', 'in_progress', 'waiting_for_user']);

function fmtHours(h) {
  if (h === null || h === undefined) return '-';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

function fmtSlaTarget(h) {
  if (h < 24) return `${h}h`;
  return `${h / 24}d`;
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAgeRange, setActiveAgeRange] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/tickets?limit=500'),
    ])
      .then(([analyticsRes, issuesRes]) => {
        setData(analyticsRes.data);
        setIssues(issuesRes.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const volume = data?.volume;
  const avgResolutionHours = data?.avg_resolution_hours;
  const overallSlaRate = data?.overall_sla_rate;
  const byPriority = data?.by_priority || [];
  const dailyVolume = data?.daily_volume || [];
  const aging = data?.aging || [];
  const equipment = data?.equipment ?? null;

  const maxDaily = Math.max(...dailyVolume.map(d => d.count), 1);
  const agingTotal = aging.reduce((sum, item) => sum + item.count, 0) || 1;

  const priorityMap = Object.fromEntries(byPriority.map(row => [row.priority, row]));
  const priorityRows = PRIORITY_ORDER.map(priority => priorityMap[priority] || {
    priority,
    total: 0,
    resolved: 0,
    avg_hours: null,
    within_sla: 0,
    sla_target_hours: { critical: 4, high: 24, medium: 72, low: 168 }[priority],
    sla_rate: null,
  });

  const filteredAgeIssues = useMemo(() => {
    if (!activeAgeRange) return [];
    return issues
      .filter(issue => OPEN_STATUSES.has(issue.status))
      .filter(issue => matchesAgeRange(issue.created_at, activeAgeRange));
  }, [issues, activeAgeRange]);

  if (loading) return <div className="analytics-state">Loading analytics...</div>;
  if (error) return <div className="analytics-state analytics-state--error">Failed to load: {error}</div>;

  return (
    <div className="analytics">
      <div className="analytics__kpis">
        <KpiCard
          label="Total Issues"
          value={volume.total}
          sub={`${volume.today} today · ${volume.this_week} this week`}
          tip="All tickets and bug reports ever submitted to the portal."
        />
        <KpiCard
          label="Open"
          value={volume.open}
          sub={`${volume.in_progress} in progress`}
          accent="warning"
          tip="Unresolved issues: Open + In Progress + Waiting for User. Does not include Solved or Merged."
        />
        <KpiCard
          label="Avg Resolution"
          value={fmtHours(avgResolutionHours)}
          sub="across solved issues"
          tip="Average time from ticket submission to Solved, weighted across all priorities."
        />
        <KpiCard
          label="SLA Compliance"
          value={overallSlaRate !== null ? `${overallSlaRate}%` : '-'}
          sub="solved issues within target"
          accent={overallSlaRate >= 80 ? 'success' : overallSlaRate >= 60 ? 'warning' : 'danger'}
          tip="Percentage of resolved tickets closed within their priority SLA target. 80%+ is healthy. Below 60% needs attention."
        />
      </div>

      <div className="analytics__two-col">
        <div className="analytics__panel">
          <div className="analytics__panel-header">
            <h3>Ticket Volume</h3>
            <span className="analytics__panel-sub">Last 14 days</span>
          </div>
          <div className="bar-chart">
            {dailyVolume.map(day => (
              <div key={day.date} className="bar-chart__col">
                <div className="bar-chart__bar-wrap">
                  <div
                    className="bar-chart__bar"
                    style={{ height: `${Math.max((day.count / maxDaily) * 100, day.count > 0 ? 4 : 0)}%` }}
                    title={`${day.count} issue${day.count !== 1 ? 's' : ''}`}
                  >
                    {day.count > 0 && <span className="bar-chart__tip">{day.count}</span>}
                  </div>
                </div>
                <span className="bar-chart__label">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics__panel">
          <div className="analytics__panel-header">
            <h3>Ticket and Bug Age</h3>
            <span className="analytics__panel-sub">{volume.open + volume.in_progress} unresolved</span>
          </div>
          {aging.length === 0 ? (
            <div className="analytics__empty">No open issues.</div>
          ) : (
            <div className="aging-chart">
              {aging.map(item => (
                <button
                  key={item.range}
                  type="button"
                  className="aging-row aging-row--button"
                  onClick={() => setActiveAgeRange(item.range)}
                >
                  <div className="aging-row__label">{item.range}</div>
                  <div className="aging-row__track">
                    <div
                      className="aging-row__fill"
                      style={{ width: `${Math.max((item.count / agingTotal) * 100, 2)}%` }}
                    />
                  </div>
                  <div className="aging-row__count">{item.count}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
              {priorityRows.map(row => (
                <tr key={row.priority}>
                  <td>
                    <span className={`badge badge--${row.priority}`}>{row.priority}</span>
                  </td>
                  <td className="analytics-table__num">{row.total}</td>
                  <td className="analytics-table__num">{row.resolved}</td>
                  <td className="analytics-table__num">{fmtHours(row.avg_hours)}</td>
                  <td className="analytics-table__num">{fmtSlaTarget(row.sla_target_hours)}</td>
                  <td className="analytics-table__num">
                    {row.sla_rate !== null ? (
                      <span className={`sla-rate ${row.sla_rate >= 80 ? 'sla-rate--good' : row.sla_rate >= 60 ? 'sla-rate--warn' : 'sla-rate--bad'}`}>
                        {row.sla_rate}%
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {row.resolved > 0 ? (
                      <div className="sla-bar-track">
                        <div
                          className={`sla-bar-fill ${row.sla_rate >= 80 ? 'sla-bar-fill--good' : row.sla_rate >= 60 ? 'sla-bar-fill--warn' : 'sla-bar-fill--bad'}`}
                          style={{ width: `${row.sla_rate ?? 0}%` }}
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

      <div className="analytics__panel">
        <div className="analytics__panel-header">
          <h3>Volume Breakdown</h3>
          <span className="analytics__panel-sub">Real counts from current issue records</span>
        </div>
        <div className="volume-strip">
          {[
            { label: 'Tickets', value: volume.tickets, color: '#1d4ed8' },
            { label: 'Bug Reports', value: volume.bugs, color: '#b91c1c' },
          ].map(item => (
            <div key={item.label} className="volume-strip__item">
              <div className="volume-strip__bar" style={{ backgroundColor: item.color, width: `${Math.max((item.value / (volume.total || 1)) * 100, 2)}%` }} />
              <div className="volume-strip__label">{item.label}</div>
              <div className="volume-strip__count">{item.value}</div>
              <div className="volume-strip__pct">
                {volume.total > 0 ? `${Math.round((item.value / volume.total) * 100)}%` : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {equipment && (
        <div className="analytics__panel">
          <div className="analytics__panel-header">
            <h3>Equipment Requests</h3>
            <span className="analytics__panel-sub">{equipment.today} today · {equipment.this_week} this week</span>
          </div>
          <div className="analytics__kpis analytics__kpis--sm">
            <KpiCard label="Total" value={equipment.total} />
            <KpiCard label="Pending"   value={equipment.pending}   accent="warning" />
            <KpiCard label="Approved"  value={equipment.approved}  accent="success" />
            <KpiCard label="Fulfilled" value={equipment.fulfilled} />
          </div>
        </div>
      )}

      <Drawer
        open={!!activeAgeRange}
        onClose={() => setActiveAgeRange(null)}
        title={activeAgeRange ? `${activeAgeRange} Issues` : 'Issue Age'}
      >
        {activeAgeRange && (
          <div className="analytics-drawer">
            <p className="analytics-drawer__intro">
              {filteredAgeIssues.length} open issue{filteredAgeIssues.length !== 1 ? 's' : ''} in this age range.
            </p>
            {filteredAgeIssues.length === 0 ? (
              <div className="analytics__empty">No issues match this age range.</div>
            ) : (
              <div className="analytics-drawer__list">
                {filteredAgeIssues.map(issue => (
                  <button
                    key={issue.id}
                    type="button"
                    className="analytics-drawer__item"
                    onClick={() => {
                      setActiveAgeRange(null);
                      setSelectedIssue(issue);
                    }}
                  >
                    <div className="analytics-drawer__item-main">
                      <div className="analytics-drawer__item-title">
                        {issue.issue_type === 'bug' ? 'Bug Report' : 'Ticket'}: {issue.title}
                      </div>
                      <div className="analytics-drawer__item-meta">
                        <span>#{issue.id.slice(0, 6).toUpperCase()}</span>
                        <span>·</span>
                        <span>{issue.creator_name}</span>
                        <span>·</span>
                        <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="analytics-drawer__item-side">
                      <span className={`badge badge--status badge--${issue.status}`}>{issue.status.replace(/_/g, ' ')}</span>
                      <span className={`badge badge--${issue.priority}`}>{issue.priority}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {selectedIssue && (
        <TicketModal
          ticket={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onSaved={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, accent, tip }) {
  return (
    <div className={`kpi-card${accent ? ` kpi-card--${accent}` : ''}`}>
      <div className="kpi-card__label">
        {tip ? (
          <Tooltip text={tip} maxWidth="210px">
            <span style={{ borderBottom: '1px dashed currentColor', cursor: 'help' }}>{label}</span>
          </Tooltip>
        ) : label}
      </div>
      <div className="kpi-card__value">{value}</div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  );
}

function matchesAgeRange(createdAt, range) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (range === 'Under 1 day') return ageMs < oneDay;
  if (range === '1–3 days') return ageMs >= oneDay && ageMs < 3 * oneDay;
  if (range === '3–7 days') return ageMs >= 3 * oneDay && ageMs < 7 * oneDay;
  return ageMs >= 7 * oneDay;
}
