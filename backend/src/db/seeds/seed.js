import bcrypt from 'bcryptjs';
import { getDB } from '../../config/database.js';

const SEED_TICKETS = [
  {
    title: 'Application crashes on mobile Safari when uploading files',
    description: 'Users on iOS 17+ with Safari experience a hard crash when uploading files larger than 5MB through the attachment interface. The app closes with no error message. Reproducible 100% of the time on affected devices.',
    priority: 'critical',
    status: 'open',
    events: [
      { type: 'created', detail: 'Ticket opened', daysAgo: 3 },
    ],
  },
  {
    title: 'Login loop — redirected back to login after successful authentication',
    description: 'After entering valid credentials the session cookie is set but users are immediately redirected back to the login screen. Affects approximately 15% of users. First observed after the deployment on Monday.',
    priority: 'high',
    status: 'in_progress',
    events: [
      { type: 'created',        detail: 'Ticket opened', daysAgo: 5 },
      { type: 'priority_changed', detail: 'Priority changed from "medium" to "high"', daysAgo: 4 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 3 },
    ],
  },
  {
    title: 'Database timeout errors during peak hours (9 AM – 11 AM)',
    description: 'Production database throws connection timeout errors between 9–11 AM on weekdays. Query logs show a spike in slow queries on the tickets table. Response times degrade from 120 ms average to over 8 000 ms.',
    priority: 'critical',
    status: 'in_progress',
    events: [
      { type: 'created',        detail: 'Ticket opened', daysAgo: 7 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 6 },
      { type: 'assigned',       detail: 'Ticket assigned to Admin', daysAgo: 6 },
    ],
  },
  {
    title: 'Email notifications not delivered for ticket status updates',
    description: 'Users stopped receiving email notifications when their ticket status changes. The mail queue shows messages being queued but SMTP delivery is silently failing. No bounce reports are being received on our end.',
    priority: 'high',
    status: 'open',
    events: [
      { type: 'created', detail: 'Ticket opened', daysAgo: 2 },
    ],
  },
  {
    title: 'Admin panel inaccessible after forced password reset',
    description: 'Admins who went through the forced password reset flow last week cannot access the admin panel. Login succeeds but the admin role is not being preserved in the session token. Affects all admins who reset passwords.',
    priority: 'high',
    status: 'resolved',
    events: [
      { type: 'created',        detail: 'Ticket opened', daysAgo: 10 },
      { type: 'priority_changed', detail: 'Priority changed from "medium" to "high"', daysAgo: 9 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 8 },
      { type: 'status_changed', detail: 'Status changed from "in progress" to "resolved" — root cause was a missing role claim in the JWT refresh path', daysAgo: 6 },
    ],
  },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export async function runSeeds() {
  const db = getDB();

  // ── Default admin ────────────────────────────────────────
  const adminEmail    = process.env.DEFAULT_ADMIN_EMAIL    || 'admin@tickets.local';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin1234!';

  let adminId;
  const existingAdmin = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existingAdmin.rows.length) {
    adminId = existingAdmin.rows[0].id;
  } else {
    const hash = await bcrypt.hash(adminPassword, 12);
    const result = await db.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [adminEmail, 'Admin', hash, 'admin']
    );
    adminId = result.rows[0].id;
    console.log(`Default admin created: ${adminEmail}`);
  }

  // ── Seed tickets (once only) ─────────────────────────────
  const ticketCount = await db.query('SELECT COUNT(*) FROM tickets');
  if (parseInt(ticketCount.rows[0].count) > 0) return;

  for (const t of SEED_TICKETS) {
    const ticketResult = await db.query(
      `INSERT INTO tickets (title, description, priority, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
      [t.title, t.description, t.priority, t.status, adminId, daysAgo(t.events[0].daysAgo)]
    );
    const ticketId = ticketResult.rows[0].id;

    for (const ev of t.events) {
      await db.query(
        `INSERT INTO ticket_events (ticket_id, user_id, user_name, event_type, detail, created_at)
         VALUES ($1, $2, 'Admin', $3, $4, $5)`,
        [ticketId, adminId, ev.type, ev.detail, daysAgo(ev.daysAgo)]
      );
    }
  }

  console.log(`Seeded ${SEED_TICKETS.length} support tickets.`);
}
