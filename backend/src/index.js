import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB, getDB } from './config/database.js';
import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seeds/seed.js';

const PORT = process.env.PORT || 3001;

async function startEmailPoller() {
  if (!process.env.AGENTMAIL_API_KEY) return;
  const INTERVAL = parseInt(process.env.EMAIL_POLL_INTERVAL_MS || '60000');
  const { pollInbox } = await import('./modules/email/email.service.js');
  async function poll() {
    try {
      const created = await pollInbox();
      if (created.length) console.log(`Email poll: ${created.length} new ticket(s) created`);
    } catch (err) {
      console.error('Email poll error:', err.message);
    }
  }
  await poll();
  setInterval(poll, INTERVAL);
  console.log(`Email poller running every ${INTERVAL / 1000}s`);
}

async function getRetentionSetting(key, fallback) {
  try {
    const db = getDB();
    const r = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    return parseInt(r.rows[0]?.value || fallback, 10);
  } catch {
    return fallback;
  }
}

async function runRetentionJob() {
  const db = getDB();
  try {
    const retentionYears = await getRetentionSetting('data_retention_years', 6);
    // Hard-delete tickets that were soft-deleted more than retentionYears ago.
    // CASCADE removes ticket_events and ticket_shares automatically.
    const tickets = await db.query(
      `DELETE FROM tickets
       WHERE deleted_at IS NOT NULL
         AND deleted_at < NOW() - ($1 || ' years')::INTERVAL`,
      [retentionYears]
    );
    if (tickets.rowCount > 0) {
      console.log(`Retention: permanently removed ${tickets.rowCount} ticket(s) older than ${retentionYears} years`);
    }
  } catch (err) {
    console.error('Retention job (tickets) error:', err.message);
  }
  try {
    const auditYears = await getRetentionSetting('audit_retention_years', 6);
    const logs = await db.query(
      `DELETE FROM audit_log
       WHERE created_at < NOW() - ($1 || ' years')::INTERVAL`,
      [auditYears]
    );
    if (logs.rowCount > 0) {
      console.log(`Retention: purged ${logs.rowCount} audit log entry/entries older than ${auditYears} years`);
    }
  } catch (err) {
    console.error('Retention job (audit_log) error:', err.message);
  }
}

function startRetentionScheduler() {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // Run once 30 seconds after startup (after migrations settle), then every 24 hours
  setTimeout(() => {
    runRetentionJob();
    setInterval(runRetentionJob, MS_PER_DAY);
  }, 30_000);
}

async function checkScheduledBackup() {
  try {
    const { getBackupConfig, isScheduledBackupDue, runBackup } = await import('./modules/backups/backups.service.js');
    const config = await getBackupConfig();
    if (await isScheduledBackupDue(config)) {
      console.log('Running scheduled backup…');
      const run = await runBackup({ trigger: 'scheduled' });
      console.log(`Scheduled backup ${run.status}: ${run.object_key || run.error}`);
    }
  } catch (err) {
    console.error('Scheduled backup check error:', err.message);
  }
}

function startBackupScheduler() {
  const MS_PER_MINUTE = 60 * 1000;
  setTimeout(() => {
    checkScheduledBackup();
    setInterval(checkScheduledBackup, MS_PER_MINUTE);
  }, 30_000);
}

async function start() {
  await connectDB();
  await runMigrations();
  await runSeeds();
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
  await startEmailPoller();
  startRetentionScheduler();
  startBackupScheduler();
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
