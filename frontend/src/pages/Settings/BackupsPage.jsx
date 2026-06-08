import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api.js';
import './BackupsPage.css';

const FREQUENCIES = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const GENERATION_LABEL = { son: 'Son (latest)', father: 'Father', grandfather: 'Grandfather (oldest)' };

function showToast(setToast, msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtBytes(n) {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// ── Storage provider section ───────────────────────────────────────────────
function ProviderSection({ config, onChange, onSave, saving }) {
  const isR2 = config.backup_provider === 'r2';
  const isS3 = config.backup_provider === 's3';

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Storage Provider</h3>
        <p className="backups-section__desc">Choose where encrypted backup archives are uploaded. Only one provider can be active at a time.</p>
      </div>
      <div className="backups-section__body">
        <div className="form-field">
          <label className="form-label" htmlFor="bk-provider">Provider</label>
          <select
            id="bk-provider"
            className="form-select"
            value={config.backup_provider || ''}
            onChange={e => onChange('backup_provider', e.target.value)}
          >
            <option value="">Select a provider…</option>
            <option value="s3">Amazon S3</option>
            <option value="r2">Cloudflare R2</option>
          </select>
        </div>

        {(isR2 || isS3) && (
          <div className="backups-form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="bk-key">Access key ID</label>
              <input
                id="bk-key"
                className="form-input"
                autoComplete="off"
                value={config.backup_access_key_id || ''}
                onChange={e => onChange('backup_access_key_id', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="bk-secret">Secret access key</label>
              <input
                id="bk-secret"
                type="password"
                className="form-input"
                autoComplete="off"
                value={config.backup_secret_access_key || ''}
                onChange={e => onChange('backup_secret_access_key', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="bk-bucket">Bucket name</label>
              <input
                id="bk-bucket"
                className="form-input"
                value={config.backup_bucket || ''}
                onChange={e => onChange('backup_bucket', e.target.value)}
              />
            </div>
            {isS3 && (
              <div className="form-field">
                <label className="form-label" htmlFor="bk-region">Region</label>
                <input
                  id="bk-region"
                  className="form-input"
                  placeholder="us-east-1"
                  value={config.backup_region || ''}
                  onChange={e => onChange('backup_region', e.target.value)}
                />
              </div>
            )}
            {isR2 && (
              <div className="form-field">
                <label className="form-label" htmlFor="bk-endpoint">Account endpoint URL</label>
                <input
                  id="bk-endpoint"
                  className="form-input"
                  placeholder="https://<account-id>.r2.cloudflarestorage.com"
                  value={config.backup_endpoint || ''}
                  onChange={e => onChange('backup_endpoint', e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="backups-section__footer">
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save provider settings'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Schedule section ────────────────────────────────────────────────────────
function ScheduleSection({ config, onChange, onSave, saving }) {
  const frequency = config.backup_schedule_frequency || 'daily';
  const enabled   = config.backup_schedule_enabled === 'true';

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Backup Schedule</h3>
        <p className="backups-section__desc">Run backups automatically. By default, scheduled backups run nightly at 12:00 AM.</p>
      </div>
      <div className="backups-section__body">
        <label className="drawer-toggle">
          <input
            type="checkbox"
            className="drawer-toggle__check"
            checked={enabled}
            onChange={e => onChange('backup_schedule_enabled', e.target.checked ? 'true' : 'false')}
          />
          <div className="drawer-toggle__info">
            <div className="drawer-toggle__label">Run backups automatically</div>
            <div className="drawer-toggle__desc">When enabled, a backup runs on the schedule below without anyone needing to start it.</div>
          </div>
        </label>

        {enabled && (
          <div className="backups-form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="bk-frequency">Frequency</label>
              <select
                id="bk-frequency"
                className="form-select"
                value={frequency}
                onChange={e => onChange('backup_schedule_frequency', e.target.value)}
              >
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {frequency === 'weekly' && (
              <div className="form-field">
                <label className="form-label" htmlFor="bk-day">Day of week</label>
                <select
                  id="bk-day"
                  className="form-select"
                  value={config.backup_schedule_day ?? '0'}
                  onChange={e => onChange('backup_schedule_day', e.target.value)}
                >
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}

            {frequency === 'monthly' && (
              <div className="form-field">
                <label className="form-label" htmlFor="bk-day">Day of month</label>
                <select
                  id="bk-day"
                  className="form-select"
                  value={config.backup_schedule_day ?? '1'}
                  onChange={e => onChange('backup_schedule_day', e.target.value)}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            <div className="form-field">
              <label className="form-label" htmlFor="bk-time">Time of day</label>
              <input
                id="bk-time"
                type="time"
                className="form-input"
                value={config.backup_schedule_time || '00:00'}
                onChange={e => onChange('backup_schedule_time', e.target.value)}
              />
            </div>
          </div>
        )}

        {enabled && config.next_run && (
          <p className="backups-next-run">
            <span className="material-symbols-outlined">schedule</span>
            Next scheduled run: <strong>{fmtDateTime(config.next_run)}</strong>
          </p>
        )}

        <div className="backups-section__footer">
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Retention section ───────────────────────────────────────────────────────
function RetentionSection({ config, onChange, onSave, saving }) {
  const count = parseInt(config.backup_retention_count, 10) || 3;

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Backup Retention</h3>
        <p className="backups-section__desc">
          Backups rotate using a grandfather–father–son scheme: the most recent backup is the <strong>son</strong>,
          the previous one becomes the <strong>father</strong>, and the oldest retained copy is the <strong>grandfather</strong>.
          Once the limit below is reached, the oldest backup is deleted from storage as each new one completes successfully.
        </p>
      </div>
      <div className="backups-section__body">
        <div className="form-field backups-form-field--narrow">
          <label className="form-label" htmlFor="bk-retention">Backups to keep</label>
          <select
            id="bk-retention"
            className="form-select"
            value={count}
            onChange={e => onChange('backup_retention_count', e.target.value)}
          >
            <option value="1">1 (son only)</option>
            <option value="2">2 (son + father)</option>
            <option value="3">3 (son + father + grandfather)</option>
          </select>
        </div>
        <div className="backups-section__footer">
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save retention'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Test & run section ──────────────────────────────────────────────────────
function TestSection({ onRan }) {
  const [armed,   setArmed]   = useState(false);
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const { data } = await api.post('/backups/test');
      setResult(data);
      if (data.success) onRan?.();
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Request failed' });
    } finally {
      setRunning(false);
      setArmed(false);
    }
  }

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Test Connection &amp; Backup</h3>
        <p className="backups-section__desc">Verify your storage credentials work, end to end.</p>
      </div>
      <div className="backups-section__body">
        <div className="backups-warning">
          <span className="material-symbols-outlined backups-warning__icon">warning</span>
          <p className="backups-warning__text">
            <strong>This is not a dry run.</strong> Clicking the button below connects to your configured bucket,
            then immediately exports and uploads a real backup of the database, tickets, and users — exactly like a
            scheduled run. It also counts toward your retention limit and may delete an older backup.
          </p>
        </div>

        {!armed && (
          <button className="btn btn--primary" onClick={() => setArmed(true)} disabled={running}>
            <span className="material-symbols-outlined">cloud_sync</span>
            Test connection &amp; run backup
          </button>
        )}
        {armed && (
          <div className="backups-confirm">
            <span>Run a real connection test and backup now?</span>
            <button className="btn btn--sm btn--primary" onClick={run} disabled={running}>
              {running ? 'Running…' : 'Yes, run it'}
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setArmed(false)} disabled={running}>Cancel</button>
          </div>
        )}

        {result && (
          <div className={`backups-result ${result.success ? 'backups-result--ok' : 'backups-result--fail'}`}>
            {result.success
              ? `✓ Connected and backed up successfully — ${fmtBytes(result.run?.size_bytes)} uploaded to ${result.run?.object_key}`
              : `✗ Failed — ${result.error}`}
          </div>
        )}
      </div>
    </section>
  );
}

// ── History section ─────────────────────────────────────────────────────────
function HistorySection({ history }) {
  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Backup History</h3>
        <p className="backups-section__desc">Most recent runs, including scheduled, manual test, and failed attempts.</p>
      </div>
      <div className="settings-table-wrap">
        <table className="settings-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Generation</th>
              <th>Size</th>
              <th>Started by</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={6} className="backups-empty">No backups have run yet.</td></tr>
            )}
            {history.map(run => (
              <tr key={run.id}>
                <td className="settings-table__date">{fmtDateTime(run.started_at)}</td>
                <td className="backups-cell--capitalize">{run.trigger}</td>
                <td>
                  <span className={`badge badge--status badge--${run.status === 'success' ? 'solved' : run.status === 'failed' ? 'closed' : 'in_progress'}`}>
                    {run.status}
                  </span>
                </td>
                <td>{run.generation ? GENERATION_LABEL[run.generation] : '—'}</td>
                <td>{fmtBytes(run.size_bytes)}</td>
                <td>{run.started_by_name || (run.trigger === 'scheduled' ? 'System' : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function BackupsPage() {
  const [config,  setConfig]  = useState(null);
  const [history, setHistory] = useState([]);
  const [saving,  setSaving]  = useState(null);
  const [toast,   setToast]   = useState('');

  const loadConfig  = useCallback(() => api.get('/backups').then(r => setConfig(r.data)).catch(() => {}), []);
  const loadHistory = useCallback(() => api.get('/backups/history').then(r => setHistory(r.data)).catch(() => {}), []);

  useEffect(() => { loadConfig(); loadHistory(); }, [loadConfig, loadHistory]);

  function handleChange(key, value) {
    setConfig(c => ({ ...c, [key]: value }));
  }

  async function save(keys, section) {
    setSaving(section);
    try {
      const payload = Object.fromEntries(keys.map(k => [k, config[k] ?? '']));
      const { data } = await api.patch('/backups', payload);
      setConfig(data);
      showToast(setToast, 'Saved');
    } catch {
      showToast(setToast, 'Error saving');
    } finally {
      setSaving(null);
    }
  }

  if (!config) return <div className="drawer-loading">Loading…</div>;

  return (
    <div className="backups-page">
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}

      <ProviderSection
        config={config}
        onChange={handleChange}
        saving={saving === 'provider'}
        onSave={() => save(['backup_provider', 'backup_access_key_id', 'backup_secret_access_key', 'backup_bucket', 'backup_region', 'backup_endpoint'], 'provider')}
      />

      <ScheduleSection
        config={config}
        onChange={handleChange}
        saving={saving === 'schedule'}
        onSave={() => save(['backup_schedule_enabled', 'backup_schedule_frequency', 'backup_schedule_day', 'backup_schedule_time'], 'schedule')}
      />

      <RetentionSection
        config={config}
        onChange={handleChange}
        saving={saving === 'retention'}
        onSave={() => save(['backup_retention_count'], 'retention')}
      />

      <TestSection onRan={loadHistory} />

      <HistorySection history={history} />
    </div>
  );
}
