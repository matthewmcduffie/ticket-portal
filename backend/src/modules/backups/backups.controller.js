import * as svc from './backups.service.js';

export async function getConfig(req, res) {
  try {
    const config = await svc.getBackupConfig();
    res.json({ ...config, next_run: svc.nextScheduledRun(config) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateConfig(req, res) {
  try {
    await svc.saveBackupConfig(req.body);
    const config = await svc.getBackupConfig();
    res.json({ ...config, next_run: svc.nextScheduledRun(config) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listHistory(req, res) {
  try {
    res.json(await svc.listBackupRuns(20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Runs a real backup end to end — the frontend warns the admin before calling
// this. runBackup() checks the bucket connection as its first step and records
// the attempt (including connection failures) in backup_runs either way.
export async function testAndBackup(req, res) {
  try {
    const run = await svc.runBackup({ trigger: 'test', userId: req.user.id });
    res.json({ success: true, run });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

// ── Restore ─────────────────────────────────────────────────────────────────

export async function listCloudObjects(req, res) {
  try {
    const objects = await svc.listCloudBackups();
    res.json(objects);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function restoreFromCloud(req, res) {
  try {
    const { object_key } = req.body;
    if (!object_key) return res.status(400).json({ error: 'object_key is required.' });
    const run = await svc.restoreFromCloud({ objectKey: object_key, userId: req.user.id });
    res.json({ success: true, run });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function restoreFromUploadJson(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A backup file is required.' });
    const run = await svc.restoreFromUploadJson({ buffer: req.file.buffer, filename: req.file.originalname, userId: req.user.id });
    res.json({ success: true, run });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function restoreFromUploadSql(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A SQL dump file is required.' });
    const run = await svc.restoreFromSqlDump({ buffer: req.file.buffer, filename: req.file.originalname, userId: req.user.id });
    res.json({ success: true, run });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

export async function listRestoreHistory(req, res) {
  try {
    res.json(await svc.listRestoreRuns(20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
