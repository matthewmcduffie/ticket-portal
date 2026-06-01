import { getDB } from '../../config/database.js';

// SLA targets in hours by priority
const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

export async function getOverview() {
  const db = getDB();

  // ── Volume counts ──────────────────────────────────────
  const { rows: [vol] } = await db.query(`
    SELECT
      COUNT(*)                                                                AS total,
      COUNT(*) FILTER (WHERE status = 'open')                              AS open,
      COUNT(*) FILTER (WHERE status = 'in_progress')                       AS in_progress,
      COUNT(*) FILTER (WHERE status = 'waiting_for_user')                  AS waiting_for_user,
      COUNT(*) FILTER (WHERE status = 'solved')                            AS solved,
      COUNT(*) FILTER (WHERE status = 'merged')                            AS merged,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')       AS today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')      AS this_week,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')     AS this_month
    FROM tickets
  `);

  // ── Resolution time + SLA per priority ────────────────
  const { rows: byPriority } = await db.query(`
    WITH resolved_times AS (
      SELECT
        t.id,
        t.priority,
        t.created_at,
        MIN(te.created_at) AS resolved_at
      FROM tickets t
      JOIN ticket_events te ON te.ticket_id = t.id
      WHERE t.status = 'solved'
        AND te.event_type = 'status_changed'
        AND te.detail ILIKE '%to "solved"%'
      GROUP BY t.id, t.priority, t.created_at
    )
    SELECT
      all_t.priority,
      COUNT(*)                                                      AS total,
      COUNT(rt.id)                                                  AS resolved_count,
      AVG(EXTRACT(EPOCH FROM (rt.resolved_at - rt.created_at))/3600)  AS avg_hours,
      COUNT(*) FILTER (
        WHERE rt.id IS NOT NULL
          AND EXTRACT(EPOCH FROM (rt.resolved_at - rt.created_at))/3600
              <= CASE all_t.priority
                   WHEN 'critical' THEN 4
                   WHEN 'high'     THEN 24
                   WHEN 'medium'   THEN 72
                   WHEN 'low'      THEN 168
                 END
      )                                                             AS within_sla
    FROM tickets all_t
    LEFT JOIN resolved_times rt ON rt.id = all_t.id
    GROUP BY all_t.priority
    ORDER BY CASE all_t.priority
      WHEN 'critical' THEN 1 WHEN 'high' THEN 2
      WHEN 'medium'   THEN 3 WHEN 'low'  THEN 4
    END
  `);

  // ── Daily volume — last 14 days ────────────────────────
  const { rows: daily } = await db.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM tickets
    WHERE created_at >= NOW() - INTERVAL '14 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  // Fill in any missing days with 0
  const dailyMap = Object.fromEntries(daily.map(r => [String(r.date).slice(0, 10), parseInt(r.count)]));
  const dailyFull = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyFull.push({ date: key, count: dailyMap[key] || 0 });
  }

  // ── Aging of open + in-progress tickets ───────────────
  const { rows: aging } = await db.query(`
    SELECT
      CASE
        WHEN NOW() - created_at < INTERVAL '24 hours' THEN 'Under 1 day'
        WHEN NOW() - created_at < INTERVAL '3 days'   THEN '1–3 days'
        WHEN NOW() - created_at < INTERVAL '7 days'   THEN '3–7 days'
        ELSE 'Over 7 days'
      END                                                    AS range,
      COUNT(*)                                               AS count,
      CASE
        WHEN NOW() - created_at < INTERVAL '24 hours' THEN 1
        WHEN NOW() - created_at < INTERVAL '3 days'   THEN 2
        WHEN NOW() - created_at < INTERVAL '7 days'   THEN 3
        ELSE 4
      END                                                    AS sort_order
    FROM tickets
    WHERE status IN ('open','in_progress','waiting_for_user')
    GROUP BY range, sort_order
    ORDER BY sort_order
  `);

  // ── Build summary numbers ──────────────────────────────
  const totalResolved   = byPriority.reduce((s, r) => s + parseInt(r.resolved_count || 0), 0);
  const totalWithinSla  = byPriority.reduce((s, r) => s + parseInt(r.within_sla || 0), 0);
  const weightedHours   = byPriority.reduce((s, r) =>
    s + parseFloat(r.avg_hours || 0) * parseInt(r.resolved_count || 0), 0);
  const avgResolutionHours = totalResolved > 0 ? weightedHours / totalResolved : null;
  const overallSlaRate     = totalResolved > 0
    ? Math.round((totalWithinSla / totalResolved) * 100) : null;

  return {
    volume: {
      total:            +vol.total,
      open:             +vol.open,
      in_progress:      +vol.in_progress,
      waiting_for_user: +vol.waiting_for_user,
      solved:           +vol.solved,
      merged:           +vol.merged,
      today:            +vol.today,
      this_week:        +vol.this_week,
      this_month:       +vol.this_month,
    },
    avg_resolution_hours: avgResolutionHours !== null
      ? Math.round(avgResolutionHours * 10) / 10 : null,
    overall_sla_rate: overallSlaRate,
    by_priority: byPriority.map(r => ({
      priority:     r.priority,
      total:        +r.total,
      resolved:     +r.resolved_count,
      avg_hours:    r.avg_hours ? Math.round(parseFloat(r.avg_hours) * 10) / 10 : null,
      within_sla:   +r.within_sla,
      sla_target_hours: SLA_HOURS[r.priority],
      sla_rate: +r.resolved_count > 0
        ? Math.round((+r.within_sla / +r.resolved_count) * 100) : null,
    })),
    daily_volume: dailyFull,
    aging: aging.map(r => ({ range: r.range, count: +r.count })),
  };
}
