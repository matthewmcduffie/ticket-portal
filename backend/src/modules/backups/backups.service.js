import { gzipSync, gunzipSync } from 'zlib';
import { spawn } from 'child_process';
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getDB } from '../../config/database.js';

const CONFIG_KEYS = [
  'backup_provider',
  'backup_access_key_id',
  'backup_secret_access_key',
  'backup_bucket',
  'backup_region',
  'backup_endpoint',
  'backup_schedule_enabled',
  'backup_schedule_frequency',
  'backup_schedule_day',
  'backup_schedule_time',
  'backup_retention_count',
];

const OBJECT_PREFIX = 'tickets-backups/';
const MAX_RETENTION = 3;

export async function getBackupConfig() {
  const db = getDB();
  const rows = await db.query(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [CONFIG_KEYS]
  );
  return Object.fromEntries(rows.rows.map(r => [r.key, r.value]));
}

export async function saveBackupConfig(updates) {
  const db = getDB();
  for (const [key, value] of Object.entries(updates)) {
    if (!CONFIG_KEYS.includes(key)) continue;
    await db.query(
      `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
      [String(value), key]
    );
  }
}

function buildClient(config) {
  if (!config.backup_provider) throw new Error('Choose a backup storage provider first.');
  if (!config.backup_access_key_id || !config.backup_secret_access_key) {
    throw new Error('Access key ID and secret access key are required.');
  }
  if (!config.backup_bucket) throw new Error('A bucket name is required.');

  const isR2 = config.backup_provider === 'r2';
  if (isR2 && !config.backup_endpoint) {
    throw new Error('Cloudflare R2 requires an account endpoint URL.');
  }

  return new S3Client({
    region: config.backup_region || 'auto',
    endpoint: isR2 ? config.backup_endpoint : (config.backup_endpoint || undefined),
    forcePathStyle: isR2,
    credentials: {
      accessKeyId: config.backup_access_key_id,
      secretAccessKey: config.backup_secret_access_key,
    },
  });
}

// HeadBucket responses carry no body, so the SDK's own message is often just
// "UnknownError" — translate the handful of statuses admins actually hit.
function explainBucketError(err, bucket) {
  const status = err?.$metadata?.httpStatusCode;
  if (err.name === 'NotFound' || status === 404) return new Error(`Bucket "${bucket}" not found — check the bucket name and endpoint.`);
  if (err.name === 'Forbidden' || status === 403) return new Error('Access denied — check that the access key, secret, and bucket permissions are correct.');
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') return new Error('Could not reach the storage endpoint — check the endpoint URL and network access.');
  return err;
}

async function checkBucket(client, bucket) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    throw explainBucketError(err, bucket);
  }
}

async function exportData() {
  const db = getDB();
  const [users, tickets, ticketEvents] = await Promise.all([
    db.query(`SELECT id, email, name, password_hash, role, active, can_view_bug_reports, must_change_password, created_at, updated_at FROM users ORDER BY created_at`),
    db.query(`SELECT * FROM tickets ORDER BY created_at`),
    db.query(`SELECT * FROM ticket_events ORDER BY created_at`),
  ]);

  const bundle = {
    exported_at: new Date().toISOString(),
    counts: {
      users: users.rowCount,
      tickets: tickets.rowCount,
      ticket_events: ticketEvents.rowCount,
    },
    users: users.rows,
    tickets: tickets.rows,
    ticket_events: ticketEvents.rows,
  };

  return gzipSync(Buffer.from(JSON.stringify(bundle)));
}

function objectKeyFor(date) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `${OBJECT_PREFIX}backup-${stamp}.json.gz`;
}

async function listBackupObjects(client, config) {
  const out = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: config.backup_bucket,
      Prefix: OBJECT_PREFIX,
      ContinuationToken: token,
    }));
    for (const obj of page.Contents || []) out.push(obj);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
}

async function pruneOldBackups(client, config) {
  const requested = parseInt(config.backup_retention_count, 10) || MAX_RETENTION;
  const keep = Math.min(Math.max(requested, 1), MAX_RETENTION);
  const objects = await listBackupObjects(client, config);
  const stale = objects.slice(keep);
  for (const obj of stale) {
    await client.send(new DeleteObjectCommand({ Bucket: config.backup_bucket, Key: obj.Key }));
  }
  return stale.length;
}

async function recordRun({ trigger, status, objectKey, sizeBytes, error, startedBy, startedAt, finishedAt }) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO backup_runs (trigger, status, object_key, size_bytes, error, started_by, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [trigger, status, objectKey || null, sizeBytes || null, error || null, startedBy || null, startedAt, finishedAt || null]
  );
  return r.rows[0];
}

export async function runBackup({ trigger, userId }) {
  const config = await getBackupConfig();
  const startedAt = new Date();
  const client = buildClient(config);

  try {
    // Fail fast on bad credentials/bucket before we spend time exporting data.
    await checkBucket(client, config.backup_bucket);

    const payload = await exportData();
    const key = objectKeyFor(startedAt);

    await client.send(new PutObjectCommand({
      Bucket: config.backup_bucket,
      Key: key,
      Body: payload,
      ContentType: 'application/gzip',
    }));

    await pruneOldBackups(client, config);

    return recordRun({
      trigger,
      status: 'success',
      objectKey: key,
      sizeBytes: payload.length,
      startedBy: userId,
      startedAt,
      finishedAt: new Date(),
    });
  } catch (err) {
    await recordRun({
      trigger,
      status: 'failed',
      error: err.message,
      startedBy: userId,
      startedAt,
      finishedAt: new Date(),
    });
    throw err;
  }
}

export async function listBackupRuns(limit = 20) {
  const db = getDB();
  const r = await db.query(
    `SELECT br.*, u.name AS started_by_name
     FROM backup_runs br
     LEFT JOIN users u ON br.started_by = u.id
     ORDER BY br.started_at DESC
     LIMIT $1`,
    [limit]
  );

  // Label retained backups by GFS rotation position (most recent = son, oldest = grandfather).
  const successful = r.rows.filter(row => row.status === 'success');
  const labels = ['son', 'father', 'grandfather'];
  const labelByRunId = new Map(successful.slice(0, MAX_RETENTION).map((row, i) => [row.id, labels[i]]));

  return r.rows.map(row => ({ ...row, generation: labelByRunId.get(row.id) || null }));
}

export function nextScheduledRun(config, after = new Date()) {
  if (config.backup_schedule_enabled !== 'true') return null;

  const [hh, mm] = (config.backup_schedule_time || '00:00').split(':').map(n => parseInt(n, 10));
  const frequency = config.backup_schedule_frequency || 'daily';
  const day = parseInt(config.backup_schedule_day, 10) || 0;

  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(hh || 0, mm || 0, 0, 0);

  if (frequency === 'daily') {
    if (next <= after) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const target = Math.min(Math.max(day, 0), 6);
    while (next.getDay() !== target || next <= after) next.setDate(next.getDate() + 1);
  } else if (frequency === 'monthly') {
    const target = Math.min(Math.max(day, 1), 28);
    next.setDate(target);
    if (next <= after) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(target);
    }
  }

  return next;
}

function periodStart(frequency, day, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (frequency === 'weekly') {
    const target = Math.min(Math.max(day, 0), 6);
    start.setDate(start.getDate() - ((start.getDay() - target + 7) % 7));
  } else if (frequency === 'monthly') {
    start.setDate(1);
  }
  return start;
}

// Polled roughly once a minute: fires when the clock matches the configured
// time/day AND no scheduled backup has run yet in the current period — keeps
// restarts and slow ticks from triggering duplicate runs.
export async function isScheduledBackupDue(config, now = new Date()) {
  if (config.backup_schedule_enabled !== 'true') return false;

  const [hh, mm] = (config.backup_schedule_time || '00:00').split(':').map(n => parseInt(n, 10));
  if (now.getHours() !== (hh || 0) || now.getMinutes() !== (mm || 0)) return false;

  const frequency = config.backup_schedule_frequency || 'daily';
  const day = parseInt(config.backup_schedule_day, 10) || 0;
  if (frequency === 'weekly' && now.getDay() !== Math.min(Math.max(day, 0), 6)) return false;
  if (frequency === 'monthly' && now.getDate() !== Math.min(Math.max(day, 1), 28)) return false;

  const db = getDB();
  const r = await db.query(
    `SELECT started_at FROM backup_runs WHERE trigger = 'scheduled' ORDER BY started_at DESC LIMIT 1`
  );
  if (!r.rows[0]) return true;

  return new Date(r.rows[0].started_at) < periodStart(frequency, day, now);
}

// ── Restore ─────────────────────────────────────────────────────────────────
// Restoring is destructive by nature: it replaces the current users, tickets,
// and ticket_events with whatever the bundle contains. We rely on the existing
// FK cascade rules (tickets -> ticket_events/attachments/shares ON DELETE
// CASCADE, users -> tickets ON DELETE CASCADE) rather than TRUNCATE ... CASCADE,
// which would also wipe unrelated tables like audit_log and backup_runs.

async function recordRestoreRun({ sourceType, sourceLabel, status, startedBy, startedAt }) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO restore_runs (source_type, source_label, status, started_by, started_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sourceType, sourceLabel || null, status, startedBy || null, startedAt]
  );
  return r.rows[0];
}

// On a successful bundle restore, the DELETE FROM users (cascading
// ON DELETE SET NULL) wipes this very run's started_by within the same
// transaction it commits in — re-stamp it afterward so the record doesn't
// look anonymous once the user has been reimported.
async function finishRestoreRun(id, { status, summary, error, finishedAt, restampStartedBy }) {
  const db = getDB();
  const r = await db.query(
    `UPDATE restore_runs SET status = $1, summary = $2, error = $3, finished_at = $4,
       started_by = COALESCE($5, started_by)
     WHERE id = $6 RETURNING *`,
    [status, summary || null, error || null, finishedAt, restampStartedBy || null, id]
  );
  return r.rows[0];
}

export async function listRestoreRuns(limit = 20) {
  const db = getDB();
  const r = await db.query(
    `SELECT rr.*, u.name AS started_by_name
     FROM restore_runs rr
     LEFT JOIN users u ON rr.started_by = u.id
     ORDER BY rr.started_at DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export async function listCloudBackups() {
  const config = await getBackupConfig();
  const client = buildClient(config);
  await checkBucket(client, config.backup_bucket);
  const objects = await listBackupObjects(client, config);
  return objects.map(o => ({ key: o.Key, size_bytes: o.Size, last_modified: o.LastModified }));
}

async function downloadObject(client, bucket, key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isGzip(buffer) {
  return buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function parseBundle(buffer) {
  const raw = isGzip(buffer) ? gunzipSync(buffer) : buffer;
  let bundle;
  try {
    bundle = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Error('File is not valid JSON (or a gzipped JSON bundle).');
  }
  if (!bundle || !Array.isArray(bundle.users) || !Array.isArray(bundle.tickets) || !Array.isArray(bundle.ticket_events)) {
    throw new Error('This does not look like a backup bundle — expected "users", "tickets", and "ticket_events" arrays.');
  }
  return bundle;
}

// Upserts by id rather than delete-then-insert: rows that survive the restore
// keep their identity, so foreign keys elsewhere (audit_log, backup_runs,
// email_whitelist, this very restore_runs table…) don't get nulled out by
// ON DELETE SET NULL just because their target was momentarily removed.
// `deferColumn`, when given, is nulled on first pass and patched in afterward —
// needed for self-referential columns (tickets.merged_into) so row order in
// the bundle never trips a foreign-key violation.
async function upsertRows(client, table, rows, { deferColumn } = {}) {
  for (const row of rows) {
    const data = deferColumn ? { ...row, [deferColumn]: null } : row;
    const columns = Object.keys(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const updates = columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      columns.map(c => data[c])
    );
  }
  if (deferColumn) {
    for (const row of rows) {
      if (row[deferColumn] != null) {
        await client.query(`UPDATE ${table} SET ${deferColumn} = $1 WHERE id = $2`, [row[deferColumn], row.id]);
      }
    }
  }
}

async function deleteMissing(client, table, keepIds) {
  if (keepIds.length === 0) await client.query(`DELETE FROM ${table}`);
  else await client.query(`DELETE FROM ${table} WHERE id <> ALL($1::uuid[])`, [keepIds]);
}

// Brings users/tickets/ticket_events to exactly match the bundle — upsert
// what the bundle has, then prune anything created or changed since the
// backup was taken — inside a single transaction (either everything lands or
// nothing changes).
async function applyBundleRestore(buffer) {
  const bundle = parseBundle(buffer);
  const db = getDB();
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await upsertRows(client, 'users', bundle.users);
    await upsertRows(client, 'tickets', bundle.tickets, { deferColumn: 'merged_into' });
    await upsertRows(client, 'ticket_events', bundle.ticket_events);

    await deleteMissing(client, 'ticket_events', bundle.ticket_events.map(r => r.id));
    await deleteMissing(client, 'tickets', bundle.tickets.map(r => r.id));
    await deleteMissing(client, 'users', bundle.users.map(r => r.id));

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return `Restored ${bundle.users.length} users, ${bundle.tickets.length} tickets, ${bundle.ticket_events.length} ticket events.`;
}

export async function restoreFromCloud({ objectKey, userId }) {
  const startedAt = new Date();
  const run = await recordRestoreRun({ sourceType: 'cloud', sourceLabel: objectKey, status: 'running', startedBy: userId, startedAt });
  try {
    const config = await getBackupConfig();
    const client = buildClient(config);
    await checkBucket(client, config.backup_bucket);
    const buffer = await downloadObject(client, config.backup_bucket, objectKey);
    const summary = await applyBundleRestore(buffer);
    return await finishRestoreRun(run.id, { status: 'success', summary, finishedAt: new Date(), restampStartedBy: userId });
  } catch (err) {
    await finishRestoreRun(run.id, { status: 'failed', error: err.message, finishedAt: new Date() });
    throw err;
  }
}

export async function restoreFromUploadJson({ buffer, filename, userId }) {
  const startedAt = new Date();
  const run = await recordRestoreRun({ sourceType: 'upload_json', sourceLabel: filename, status: 'running', startedBy: userId, startedAt });
  try {
    const summary = await applyBundleRestore(buffer);
    return await finishRestoreRun(run.id, { status: 'success', summary, finishedAt: new Date(), restampStartedBy: userId });
  } catch (err) {
    await finishRestoreRun(run.id, { status: 'failed', error: err.message, finishedAt: new Date() });
    throw err;
  }
}

// Pipes the uploaded file straight into psql so COPY blocks from pg_dump
// (which the pg driver can't execute directly) work the same as `psql -f`.
function runPsql(sqlText) {
  return new Promise((resolve, reject) => {
    const proc = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-q'], {
      env: {
        ...process.env,
        PGHOST: process.env.DB_HOST,
        PGPORT: process.env.DB_PORT || '5432',
        PGDATABASE: process.env.DB_NAME,
        PGUSER: process.env.DB_USER,
        PGPASSWORD: process.env.DB_PASSWORD,
      },
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `psql exited with code ${code}`));
    });
    proc.stdin.write(sqlText);
    proc.stdin.end();
  });
}

export async function restoreFromSqlDump({ buffer, filename, userId }) {
  const startedAt = new Date();
  const run = await recordRestoreRun({ sourceType: 'upload_sql', sourceLabel: filename, status: 'running', startedBy: userId, startedAt });
  try {
    await runPsql(buffer.toString('utf8'));
    return await finishRestoreRun(run.id, { status: 'success', summary: 'SQL dump executed successfully.', finishedAt: new Date(), restampStartedBy: userId });
  } catch (err) {
    await finishRestoreRun(run.id, { status: 'failed', error: err.message, finishedAt: new Date() });
    throw err;
  }
}
