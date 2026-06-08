import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api.js';
import './BackupsPage.css';
import './RestorePage.css';

const CONFIRM_PHRASE = 'RESTORE';

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

const SOURCE_LABEL = { cloud: 'Cloud backup', upload_json: 'Uploaded JSON', upload_sql: 'Uploaded SQL dump' };

// ── Shared "type to confirm" gate for destructive restore actions ──────────
function DangerConfirm({ disabled, busy, onConfirm, children }) {
  const [armed, setArmed] = useState(false);
  const [phrase, setPhrase] = useState('');
  const ready = phrase.trim().toUpperCase() === CONFIRM_PHRASE;

  if (!armed) {
    return (
      <button className="btn btn--danger" disabled={disabled || busy} onClick={() => setArmed(true)}>
        <span className="material-symbols-outlined">restore</span>
        {children}
      </button>
    );
  }

  return (
    <div className="restore-confirm">
      <p className="restore-confirm__prompt">
        This will permanently overwrite current data. Type <strong>{CONFIRM_PHRASE}</strong> to continue.
      </p>
      <div className="restore-confirm__row">
        <input
          className="form-input restore-confirm__input"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          disabled={busy}
        />
        <button
          className="btn btn--danger"
          disabled={!ready || busy}
          onClick={() => { onConfirm(); setArmed(false); setPhrase(''); }}
        >
          {busy ? 'Restoring…' : 'Restore now'}
        </button>
        <button className="btn btn--ghost" disabled={busy} onClick={() => { setArmed(false); setPhrase(''); }}>Cancel</button>
      </div>
    </div>
  );
}

function RunResult({ result }) {
  if (!result) return null;
  return (
    <div className={`backups-result ${result.success ? 'backups-result--ok' : 'backups-result--fail'}`}>
      {result.success
        ? `✓ ${result.run?.summary || 'Restore completed successfully.'}`
        : `✗ Failed — ${result.error}`}
    </div>
  );
}

// ── Restore from configured cloud backup ───────────────────────────────────
function CloudRestoreSection({ configured, onRan }) {
  const [objects, setObjects] = useState(null);
  const [error, setError]     = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null);

  const load = useCallback(() => {
    if (!configured) return;
    setObjects(null);
    setError('');
    api.get('/backups/cloud-objects')
      .then(r => setObjects(r.data))
      .catch(err => setError(err.response?.data?.error || 'Could not list backups in the configured bucket.'));
  }, [configured]);

  useEffect(() => { load(); }, [load]);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post('/backups/restore/cloud', { object_key: selected });
      setResult(data);
      if (data.success) onRan?.();
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Request failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Restore from Cloud Backup</h3>
        <p className="backups-section__desc">
          Pick one of the backups stored in your configured bucket and restore the database to that point in time.
        </p>
      </div>
      <div className="backups-section__body">
        {!configured && (
          <p className="restore-hint">Configure a storage provider on the Backups page first to restore from the cloud.</p>
        )}
        {configured && error && <p className="restore-hint restore-hint--error">{error}</p>}
        {configured && !error && objects && objects.length === 0 && (
          <p className="restore-hint">No backups were found in the configured bucket.</p>
        )}
        {configured && !error && objects && objects.length > 0 && (
          <div className="restore-list">
            {objects.map(o => (
              <label key={o.key} className="restore-list__item">
                <input
                  type="radio"
                  name="cloud-object"
                  value={o.key}
                  checked={selected === o.key}
                  onChange={() => setSelected(o.key)}
                />
                <div className="restore-list__info">
                  <div className="restore-list__name">{o.key.replace(/^tickets-backups\//, '')}</div>
                  <div className="restore-list__meta">{fmtDateTime(o.last_modified)} · {fmtBytes(o.size_bytes)}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {configured && objects?.length > 0 && (
          <div className="restore-danger">
            <span className="material-symbols-outlined restore-danger__icon">dangerous</span>
            <p className="restore-danger__text">
              Restoring <strong>replaces all current users, tickets, and ticket events</strong> with the contents of the
              selected backup. Anything created or changed since that backup was taken will be lost. This cannot be undone.
            </p>
          </div>
        )}

        {configured && objects?.length > 0 && (
          <DangerConfirm disabled={!selected} busy={busy} onConfirm={run}>
            Restore selected backup
          </DangerConfirm>
        )}

        <RunResult result={result} />
      </div>
    </section>
  );
}

// ── Restore from an uploaded file (shared by JSON and SQL variants) ────────
function FileRestoreSection({ title, description, accept, hint, dangerText, endpoint, onRan, sqlWarning }) {
  const [file, setFile]     = useState(null);
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      if (data.success) {
        onRan?.();
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
      }
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Request failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>{title}</h3>
        <p className="backups-section__desc">{description}</p>
      </div>
      <div className="backups-section__body">
        <p className="restore-hint">{hint}</p>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="restore-file-input"
          onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
        />

        {sqlWarning && (
          <div className="restore-danger">
            <span className="material-symbols-outlined restore-danger__icon">dangerous</span>
            <p className="restore-danger__text">
              <strong>This runs the file's SQL statements directly against the live database</strong>, exactly as if you
              ran them yourself with no safety checks. Only upload SQL dumps you created or fully trust.
            </p>
          </div>
        )}

        {file && (
          <div className="restore-danger">
            <span className="material-symbols-outlined restore-danger__icon">dangerous</span>
            <p className="restore-danger__text">{dangerText}</p>
          </div>
        )}

        {file && (
          <DangerConfirm disabled={!file} busy={busy} onConfirm={run}>
            Restore from {file.name}
          </DangerConfirm>
        )}

        <RunResult result={result} />
      </div>
    </section>
  );
}

// ── History ─────────────────────────────────────────────────────────────────
function HistorySection({ history }) {
  return (
    <section className="backups-section">
      <div className="backups-section__header">
        <h3>Restore History</h3>
        <p className="backups-section__desc">Most recent restore attempts, including their source and outcome.</p>
      </div>
      <div className="settings-table-wrap">
        <table className="settings-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Source</th>
              <th>Detail</th>
              <th>Status</th>
              <th>Result</th>
              <th>Started by</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={6} className="backups-empty">No restores have run yet.</td></tr>
            )}
            {history.map(run => (
              <tr key={run.id}>
                <td className="settings-table__date">{fmtDateTime(run.started_at)}</td>
                <td>{SOURCE_LABEL[run.source_type] || run.source_type}</td>
                <td className="restore-cell--truncate" title={run.source_label || ''}>{run.source_label || '—'}</td>
                <td>
                  <span className={`badge badge--status badge--${run.status === 'success' ? 'solved' : run.status === 'failed' ? 'closed' : 'in_progress'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="restore-cell--truncate" title={run.summary || run.error || ''}>{run.summary || run.error || '—'}</td>
                <td>{run.started_by_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function RestorePage() {
  const [config, setConfig]   = useState(null);
  const [history, setHistory] = useState([]);

  const loadConfig  = useCallback(() => api.get('/backups').then(r => setConfig(r.data)).catch(() => {}), []);
  const loadHistory = useCallback(() => api.get('/backups/restore/history').then(r => setHistory(r.data)).catch(() => {}), []);

  useEffect(() => { loadConfig(); loadHistory(); }, [loadConfig, loadHistory]);

  if (!config) return <div className="drawer-loading">Loading…</div>;

  const configured = !!config.backup_provider;

  return (
    <div className="backups-page">
      <div className="restore-intro">
        <span className="material-symbols-outlined restore-intro__icon">emergency_home</span>
        <p>
          Use this page to recover the database after data loss or corruption. Every option below replaces
          live data — review the warnings carefully before confirming.
        </p>
      </div>

      <CloudRestoreSection configured={configured} onRan={loadHistory} />

      <FileRestoreSection
        title="Restore from an Uploaded Backup File"
        description="Upload a backup bundle exported by this app — either the .json.gz file produced by Backups, or a plain .json export."
        accept=".json,.gz,.json.gz,application/json,application/gzip"
        hint="Accepts the gzipped JSON bundle produced by the Backups page, or a plain JSON file with the same shape (users, tickets, ticket_events)."
        dangerText={<>Restoring from <strong>{'this file replaces all current users, tickets, and ticket events'}</strong> with its contents. Anything created or changed since the file was made will be lost. This cannot be undone.</>}
        endpoint="/backups/restore/upload-json"
        onRan={loadHistory}
      />

      <FileRestoreSection
        title="Restore from a SQL Dump"
        description="For admins who maintain their own database backups (e.g. with pg_dump), upload a plain-text .sql dump to restore from."
        accept=".sql,text/plain,application/sql"
        hint="The file is executed against the live database with psql, in the same way as running `psql -f dump.sql` — including any DROP, TRUNCATE, or COPY statements it contains."
        dangerText="This executes the uploaded SQL file directly against the live database. Whatever the file does — drop tables, replace data, anything — happens for real and cannot be undone."
        endpoint="/backups/restore/upload-sql"
        sqlWarning
        onRan={loadHistory}
      />

      <HistorySection history={history} />
    </div>
  );
}
