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
    status: 'solved',
    events: [
      { type: 'created',        detail: 'Ticket opened', daysAgo: 10 },
      { type: 'priority_changed', detail: 'Priority changed from "medium" to "high"', daysAgo: 9 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 8 },
      { type: 'status_changed', detail: 'Status changed from "in progress" to "resolved" — root cause was a missing role claim in the JWT refresh path', daysAgo: 6 },
    ],
  },
  {
    title: 'Checkout app crashes after selecting dark mode',
    description: 'Switching themes in the checkout app causes a blank screen on the review step. Reproduced in Chrome 125 and Safari 17. The stack trace points to a null theme token during hydration.',
    priority: 'high',
    status: 'in_progress',
    issue_type: 'bug',
    software_name: 'Customer Checkout',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 4 },
      { type: 'assigned', detail: 'Assigned to Admin', daysAgo: 3 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 2 },
    ],
  },
  {
    title: 'Cannot export monthly billing CSV from reports page',
    description: 'Finance users receive a generic error when exporting billing reports to CSV. The spinner runs for about 10 seconds before failing.',
    priority: 'medium',
    status: 'open',
    events: [
      { type: 'created', detail: 'Ticket opened', daysAgo: 1 },
    ],
  },
  {
    title: 'Customer welcome emails arrive with duplicate footer text',
    description: 'Outbound welcome emails include the legal footer twice for some templates. This seems to affect only emails sent after template edits.',
    priority: 'low',
    status: 'waiting_for_user',
    events: [
      { type: 'created', detail: 'Ticket opened', daysAgo: 8 },
      { type: 'status_changed', detail: 'Status changed from "open" to "waiting for user"', daysAgo: 6 },
    ],
  },
  {
    title: 'VPN users intermittently lose access to the knowledge base',
    description: 'Staff connected through the corporate VPN report random 403 responses on internal help articles, usually after 15 to 20 minutes of browsing.',
    priority: 'high',
    status: 'solved',
    events: [
      { type: 'created', detail: 'Ticket opened', daysAgo: 12 },
      { type: 'assigned', detail: 'Assigned to Admin', daysAgo: 11 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 10 },
      { type: 'status_changed', detail: 'Status changed from "in progress" to "solved"', daysAgo: 8 },
    ],
  },
  {
    title: 'Inventory dashboard freezes after filtering by warehouse',
    description: 'Selecting a warehouse on the inventory dashboard leaves the page unresponsive until the tab is refreshed. Browser memory usage climbs rapidly.',
    priority: 'critical',
    status: 'open',
    issue_type: 'bug',
    software_name: 'Ops Inventory',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 1 },
    ],
  },
  {
    title: 'Scheduling portal saves appointments one hour off during DST',
    description: 'Appointments created near daylight saving transitions are stored with an incorrect offset. The confirmation screen shows the wrong hour after submit.',
    priority: 'high',
    status: 'in_progress',
    issue_type: 'bug',
    software_name: 'Care Scheduler',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 9 },
      { type: 'assigned', detail: 'Assigned to Admin', daysAgo: 8 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 7 },
    ],
  },
  {
    title: 'Self-service password reset form loops after successful submit',
    description: 'After submitting a valid reset token, the form briefly shows success and then reloads the reset screen again with the token still in the URL.',
    priority: 'medium',
    status: 'waiting_for_user',
    issue_type: 'bug',
    software_name: 'Identity Center',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 6 },
      { type: 'status_changed', detail: 'Status changed from "open" to "waiting for user"', daysAgo: 4 },
    ],
  },
  {
    title: 'Claims intake form drops provider notes on autosave',
    description: 'Long provider notes disappear after the autosave banner appears. Reproduced with notes longer than roughly 2,000 characters.',
    priority: 'high',
    status: 'solved',
    issue_type: 'bug',
    software_name: 'Claims Intake',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 15 },
      { type: 'assigned', detail: 'Assigned to Admin', daysAgo: 14 },
      { type: 'status_changed', detail: 'Status changed from "open" to "in progress"', daysAgo: 13 },
      { type: 'status_changed', detail: 'Status changed from "in progress" to "solved"', daysAgo: 11 },
    ],
  },
  {
    title: 'Patient search returns duplicate rows after recent sync',
    description: 'Users see duplicate patient matches immediately after the nightly sync finishes. Duplicates disappear after cache clears, but the first search is noisy.',
    priority: 'low',
    status: 'open',
    issue_type: 'bug',
    software_name: 'Patient Finder',
    events: [
      { type: 'created', detail: 'Bug report opened', daysAgo: 13 },
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
  await db.query('UPDATE users SET can_view_bug_reports = TRUE WHERE id = $1', [adminId]);

  await db.query(
    `INSERT INTO bug_tracker_software (name, url)
     VALUES ('Customer Checkout', 'https://checkout.local')
     ON CONFLICT (name) DO NOTHING`
  );
  await db.query(
    `INSERT INTO bug_tracker_software (name, url) VALUES
      ('Ops Inventory', 'https://ops-inventory.local'),
      ('Care Scheduler', 'https://care-scheduler.local'),
      ('Identity Center', 'https://identity-center.local'),
      ('Claims Intake', 'https://claims-intake.local'),
      ('Patient Finder', 'https://patient-finder.local')
     ON CONFLICT (name) DO NOTHING`
  );

  // ── Seed tickets (once only) ─────────────────────────────
  const ticketCount = await db.query('SELECT COUNT(*) FROM tickets');
  if (parseInt(ticketCount.rows[0].count) > 0) return;

  for (const t of SEED_TICKETS) {
    const ticketResult = await db.query(
      `INSERT INTO tickets (
         title, description, priority, status, issue_type, bug_software_id, created_by, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         CASE
           WHEN $6::text IS NULL THEN NULL
           ELSE (SELECT id FROM bug_tracker_software WHERE name = $6)
         END,
         $7, $8, $8
       )
       RETURNING id`,
      [
        t.title,
        t.description,
        t.priority,
        t.status,
        t.issue_type || 'ticket',
        t.software_name || null,
        adminId,
        daysAgo(t.events[0].daysAgo),
      ]
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
