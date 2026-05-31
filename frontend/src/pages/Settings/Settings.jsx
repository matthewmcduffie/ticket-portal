import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Drawer from '../../components/Drawer/Drawer.jsx';
import api from '../../services/api.js';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const [activeDrawer,    setActiveDrawer]    = useState(null);
  const [userCount,       setUserCount]       = useState(null);
  const [discordOk,       setDiscordOk]       = useState(false);
  const [slackOk,         setSlackOk]         = useState(false);
  const [uploadsEnabled,  setUploadsEnabled]  = useState(true);
  const [whitelistCount,  setWhitelistCount]  = useState(null);

  useEffect(() => {
    api.get('/users').then(r => setUserCount(r.data.length)).catch(() => {});
    api.get('/discord').then(r => setDiscordOk(!!r.data.discord_webhook_url)).catch(() => {});
    api.get('/slack').then(r => setSlackOk(!!r.data.slack_webhook_url)).catch(() => {});
    api.get('/attachments/config').then(r => setUploadsEnabled(r.data.enabled)).catch(() => {});
    api.get('/whitelist').then(r => setWhitelistCount(r.data.length)).catch(() => {});
  }, []);

  const CARDS = [
    {
      id: 'users',
      icon: 'group',
      iconColor: '#1a3461',
      title: 'User Management',
      description: 'Create accounts, assign roles, and manage team access.',
      meta: userCount !== null ? `${userCount} user${userCount !== 1 ? 's' : ''}` : null,
      action: 'page',
    },
    {
      id: 'app',
      icon: 'tune',
      iconColor: '#515f74',
      title: 'Application',
      description: 'App name, ticket defaults, and registration settings.',
      action: 'drawer',
    },
    {
      id: 'email',
      icon: 'mail',
      iconColor: '#0284c7',
      title: 'Email',
      description: 'AgentMail inbox for inbound tickets and outbound notifications.',
      status: 'connected',
      action: 'drawer',
    },
    {
      id: 'discord',
      icon: 'forum',
      iconColor: '#5865F2',
      title: 'Discord',
      description: 'Post ticket notifications to a Discord channel via webhook.',
      status: discordOk ? 'connected' : 'unconfigured',
      action: 'drawer',
    },
    {
      id: 'slack',
      icon: 'tag',
      iconColor: '#4A154B',
      title: 'Slack',
      description: 'Send ticket notifications to a Slack channel via incoming webhook.',
      status: slackOk ? 'connected' : 'unconfigured',
      action: 'drawer',
    },
    {
      id: 'uploads',
      icon: 'upload_file',
      iconColor: '#059669',
      title: 'File Uploads',
      description: 'Control whether users can attach files to tickets and set per-file and total size limits.',
      status: uploadsEnabled ? 'enabled' : 'disabled',
      action: 'drawer',
    },
    {
      id: 'whitelist',
      icon: 'shield',
      iconColor: '#b45309',
      title: 'Email Whitelist',
      description: 'Restrict inbound email tickets to specific addresses or domains to reduce spam.',
      meta: whitelistCount !== null
        ? (whitelistCount === 0 ? 'Open — all senders allowed' : `${whitelistCount} entr${whitelistCount !== 1 ? 'ies' : 'y'}`)
        : null,
      action: 'drawer',
    },
  ];

  function handleCard(card) {
    if (card.action === 'page') navigate('/settings/users');
    else setActiveDrawer(card.id);
  }

  return (
    <div className="settings-home">
      <div className="settings-grid">
        {CARDS.map(card => (
          <button key={card.id} className="settings-card" onClick={() => handleCard(card)}>
            <div className="settings-card__icon" style={{ backgroundColor: card.iconColor }}>
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
            <div className="settings-card__body">
              <div className="settings-card__title">{card.title}</div>
              <div className="settings-card__desc">{card.description}</div>
            </div>
            <div className="settings-card__footer">
              {card.meta && <span className="settings-card__meta">{card.meta}</span>}
              {card.status === 'connected'    && <span className="settings-card__status settings-card__status--ok">Connected</span>}
              {card.status === 'unconfigured' && <span className="settings-card__status settings-card__status--off">Not configured</span>}
              {card.status === 'enabled'      && <span className="settings-card__status settings-card__status--ok">Enabled</span>}
              {card.status === 'disabled'     && <span className="settings-card__status settings-card__status--off">Disabled</span>}
              <span className="material-symbols-outlined settings-card__arrow">
                {card.action === 'page' ? 'arrow_forward' : 'chevron_right'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <Drawer open={activeDrawer === 'app'}     onClose={() => setActiveDrawer(null)} title="Application Settings">
        <AppSettingsDrawer />
      </Drawer>

      <Drawer open={activeDrawer === 'email'}   onClose={() => setActiveDrawer(null)} title="Email Settings">
        <EmailDrawer />
      </Drawer>

      <Drawer open={activeDrawer === 'discord'} onClose={() => setActiveDrawer(null)} title="Discord Integration">
        <DiscordDrawer onConfigChange={() => api.get('/discord').then(r => setDiscordOk(!!r.data.discord_webhook_url)).catch(() => {})} />
      </Drawer>

      <Drawer open={activeDrawer === 'slack'} onClose={() => setActiveDrawer(null)} title="Slack Integration">
        <SlackDrawer onConfigChange={() => api.get('/slack').then(r => setSlackOk(!!r.data.slack_webhook_url)).catch(() => {})} />
      </Drawer>

      <Drawer open={activeDrawer === 'uploads'} onClose={() => setActiveDrawer(null)} title="File Upload Settings">
        <UploadsDrawer onConfigChange={enabled => setUploadsEnabled(enabled)} />
      </Drawer>

      <Drawer open={activeDrawer === 'whitelist'} onClose={() => setActiveDrawer(null)} title="Email Whitelist">
        <WhitelistDrawer onCountChange={n => setWhitelistCount(n)} />
      </Drawer>
    </div>
  );
}

// ─── App Settings Drawer ───────────────────────────────────────────────────────
function AppSettingsDrawer() {
  const [settings, setSettings] = useState([]);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).catch(console.error);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function save(key, value) {
    setSavingKey(key);
    try {
      const { data } = await api.patch(`/settings/${key}`, { value });
      setSettings(s => s.map(i => i.key === key ? { ...i, value: data.value } : i));
      showToast('Saved');
    } catch { showToast('Error saving'); }
    finally { setSavingKey(null); }
  }

  const appSettings = settings.filter(s =>
    !s.key.startsWith('discord_') &&
    !s.key.startsWith('email_') &&
    !s.key.startsWith('upload') &&
    s.key !== 'uploads_enabled'
  );

  return (
    <>
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}
      <div className="drawer-settings-list">
        {appSettings.map(s => (
          <AppSettingRow key={s.key} setting={s} onSave={save} saving={savingKey === s.key} />
        ))}
      </div>
    </>
  );
}

function AppSettingRow({ setting, onSave, saving }) {
  const [value, setValue] = useState(setting.value ?? '');
  const changed = value !== (setting.value ?? '');
  return (
    <div className="drawer-setting-row">
      <div className="drawer-setting-row__info">
        <div className="drawer-setting-row__key">{setting.key.replace(/_/g, ' ')}</div>
        {setting.description && <div className="drawer-setting-row__desc">{setting.description}</div>}
      </div>
      <div className="drawer-setting-row__control">
        <input className="form-input drawer-setting-row__input" value={value} onChange={e => setValue(e.target.value)} />
        <button className="btn btn--primary btn--sm" onClick={() => onSave(setting.key, value)} disabled={saving || !changed}>
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Email Drawer ──────────────────────────────────────────────────────────────
function EmailDrawer() {
  const [status, setStatus]   = useState(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult]   = useState(null);

  useEffect(() => {
    api.get('/email/status').then(r => setStatus(r.data)).catch(() => setStatus({ error: true }));
  }, []);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const { data } = await api.post('/email/test');
      setResult(data);
    } catch { setResult({ success: false, error: 'Request failed' }); }
    finally { setTesting(false); }
  }

  return (
    <>
      <div className="drawer-info-block">
        <div className="drawer-info-row">
          <span className="drawer-info-label">Inbox address</span>
          <span className="drawer-info-value drawer-info-value--mono">ticketsportal@agentmail.to</span>
        </div>
        <div className="drawer-info-row">
          <span className="drawer-info-label">Provider</span>
          <span className="drawer-info-value">AgentMail</span>
        </div>
        <div className="drawer-info-row">
          <span className="drawer-info-label">Poll interval</span>
          <span className="drawer-info-value">60 seconds</span>
        </div>
        <div className="drawer-info-row">
          <span className="drawer-info-label">Status</span>
          {status === null ? (
            <span className="drawer-info-value">Checking…</span>
          ) : status?.error ? (
            <span className="settings-card__status settings-card__status--off">Unreachable</span>
          ) : (
            <span className="settings-card__status settings-card__status--ok">Connected</span>
          )}
        </div>
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Inbound Email</h4>
        <p className="drawer-section__desc">Emails sent to <strong>ticketsportal@agentmail.to</strong> are automatically converted to tickets. The sender receives a reply with their ticket ID.</p>
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Outbound Notifications</h4>
        <p className="drawer-section__desc">Ticket creators are notified by email when their ticket is opened or its status changes.</p>
      </div>

      <div className="drawer-test">
        <button className="btn btn--primary" onClick={test} disabled={testing}>
          <span className="material-symbols-outlined">send</span>
          {testing ? 'Sending…' : 'Send test email'}
        </button>
        {result && (
          <div className={`drawer-test__result ${result.success ? 'drawer-test__result--ok' : 'drawer-test__result--fail'}`}>
            {result.success
              ? `✓ Test email sent to ${result.sentTo}`
              : `✗ Failed — ${result.error}`}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Discord Drawer ────────────────────────────────────────────────────────────
function DiscordDrawer({ onConfigChange }) {
  const [config,   setConfig]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [toast,    setToast]    = useState('');

  useEffect(() => {
    api.get('/discord').then(r => setConfig(r.data)).catch(console.error);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  function handleChange(key, value) {
    setConfig(c => ({ ...c, [key]: value }));
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await api.patch('/discord', config);
      showToast('Saved');
      onConfigChange?.();
    } catch { showToast('Error saving'); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const { data } = await api.post('/discord/test');
      setResult(data);
    } catch { setResult({ success: false, error: 'Request failed' }); }
    finally { setTesting(false); }
  }

  if (!config) return <div className="drawer-loading">Loading…</div>;

  return (
    <>
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}

      <div className="drawer-section">
        <h4 className="drawer-section__title">Webhook URL</h4>
        <p className="drawer-section__desc">Paste your Discord channel webhook URL. Ticket notifications will be posted there.</p>
        <input
          className="form-input"
          placeholder="https://discord.com/api/webhooks/…"
          value={config.discord_webhook_url || ''}
          onChange={e => handleChange('discord_webhook_url', e.target.value)}
        />
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Notification Triggers</h4>
        <div className="drawer-toggles">
          <label className="drawer-toggle">
            <input
              type="checkbox"
              className="drawer-toggle__check"
              checked={config.discord_notify_on_create === 'true'}
              onChange={e => handleChange('discord_notify_on_create', e.target.checked ? 'true' : 'false')}
            />
            <div className="drawer-toggle__info">
              <div className="drawer-toggle__label">New ticket opened</div>
              <div className="drawer-toggle__desc">Post when a ticket is created — includes subject, submitter, and severity.</div>
            </div>
          </label>
          <label className="drawer-toggle">
            <input
              type="checkbox"
              className="drawer-toggle__check"
              checked={config.discord_notify_on_update === 'true'}
              onChange={e => handleChange('discord_notify_on_update', e.target.checked ? 'true' : 'false')}
            />
            <div className="drawer-toggle__info">
              <div className="drawer-toggle__label">Ticket status updated</div>
              <div className="drawer-toggle__desc">Post when a ticket's status changes.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="drawer-actions">
        <button className="btn btn--primary" onClick={saveConfig} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn--ghost" onClick={test} disabled={testing || !config.discord_webhook_url}>
          <span className="material-symbols-outlined">send</span>
          {testing ? 'Testing…' : 'Test webhook'}
        </button>
      </div>
      {result && (
        <div className={`drawer-test__result ${result.success ? 'drawer-test__result--ok' : 'drawer-test__result--fail'}`}>
          {result.success ? '✓ Test message sent to Discord' : `✗ Failed — ${result.error}`}
        </div>
      )}
    </>
  );
}

// ─── Uploads Drawer ───────────────────────────────────────────────────────────
function UploadsDrawer({ onConfigChange }) {
  const [config,  setConfig]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  useEffect(() => {
    api.get('/attachments/config').then(r => setConfig(r.data)).catch(console.error);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function save() {
    setSaving(true);
    try {
      await api.patch('/settings/uploads_enabled',          { value: config.enabled ? 'true' : 'false' });
      await api.patch('/settings/upload_max_file_size_mb',  { value: String(config.maxFileSizeMb) });
      await api.patch('/settings/upload_max_total_size_mb', { value: String(config.maxTotalSizeMb) });
      showToast('Saved');
      onConfigChange?.(config.enabled);
    } catch { showToast('Error saving'); }
    finally { setSaving(false); }
  }

  if (!config) return <div className="drawer-loading">Loading…</div>;

  return (
    <>
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}

      <div className="drawer-section">
        <h4 className="drawer-section__title">Enable File Uploads</h4>
        <p className="drawer-section__desc">When disabled, the file attachment UI is hidden from all users and upload requests are rejected.</p>
        <div className="drawer-toggles">
          <label className="drawer-toggle">
            <input
              type="checkbox"
              className="drawer-toggle__check"
              checked={config.enabled}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
            />
            <div className="drawer-toggle__info">
              <div className="drawer-toggle__label">Allow file attachments on tickets</div>
              <div className="drawer-toggle__desc">Users can attach images, PDFs, documents, spreadsheets, and ZIP files.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Size Limits</h4>
        <p className="drawer-section__desc">Limits apply per upload action. Set either to <code>0</code> to use the server default.</p>
        <div className="drawer-size-fields">
          <div className="form-field">
            <label className="form-label" htmlFor="upload-file-size">Max file size (MB)</label>
            <input
              id="upload-file-size"
              type="number"
              min="1"
              max="500"
              className="form-input"
              value={config.maxFileSizeMb}
              onChange={e => setConfig(c => ({ ...c, maxFileSizeMb: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="upload-total-size">Max total per upload (MB)</label>
            <input
              id="upload-total-size"
              type="number"
              min="1"
              max="2000"
              className="form-input"
              value={config.maxTotalSizeMb}
              onChange={e => setConfig(c => ({ ...c, maxTotalSizeMb: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
          </div>
        </div>
        <p className="drawer-section__hint">
          Accepted types: JPEG, PNG, GIF, WebP, PDF, Word, Excel, CSV, ZIP, plain text.
        </p>
      </div>

      <div className="drawer-actions">
        <button className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  );
}

// ─── Slack Drawer ──────────────────────────────────────────────────────────────
function SlackDrawer({ onConfigChange }) {
  const [config,  setConfig]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [result,  setResult]  = useState(null);
  const [toast,   setToast]   = useState('');

  useEffect(() => {
    api.get('/slack').then(r => setConfig(r.data)).catch(console.error);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }
  function handleChange(key, value) { setConfig(c => ({ ...c, [key]: value })); }

  async function saveConfig() {
    setSaving(true);
    try {
      await api.patch('/slack', config);
      showToast('Saved');
      onConfigChange?.();
    } catch { showToast('Error saving'); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const { data } = await api.post('/slack/test');
      setResult(data);
    } catch { setResult({ success: false, error: 'Request failed' }); }
    finally { setTesting(false); }
  }

  if (!config) return <div className="drawer-loading">Loading…</div>;

  return (
    <>
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}

      <div className="drawer-section">
        <h4 className="drawer-section__title">Webhook URL</h4>
        <p className="drawer-section__desc">
          Paste your Slack incoming webhook URL below. Ticket notifications will be posted to the channel you configured.{' '}
          <a
            className="drawer-guide-link"
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noopener noreferrer"
          >
            How to create a Slack webhook →
          </a>
        </p>
        <input
          className="form-input"
          placeholder="https://hooks.slack.com/services/…"
          value={config.slack_webhook_url || ''}
          onChange={e => handleChange('slack_webhook_url', e.target.value)}
        />
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Notification Triggers</h4>
        <div className="drawer-toggles">
          <label className="drawer-toggle">
            <input
              type="checkbox"
              className="drawer-toggle__check"
              checked={config.slack_notify_on_create === 'true'}
              onChange={e => handleChange('slack_notify_on_create', e.target.checked ? 'true' : 'false')}
            />
            <div className="drawer-toggle__info">
              <div className="drawer-toggle__label">New ticket opened</div>
              <div className="drawer-toggle__desc">Post when a ticket is created — includes subject, submitter, and severity.</div>
            </div>
          </label>
          <label className="drawer-toggle">
            <input
              type="checkbox"
              className="drawer-toggle__check"
              checked={config.slack_notify_on_update === 'true'}
              onChange={e => handleChange('slack_notify_on_update', e.target.checked ? 'true' : 'false')}
            />
            <div className="drawer-toggle__info">
              <div className="drawer-toggle__label">Ticket status updated</div>
              <div className="drawer-toggle__desc">Post when a ticket's status changes.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="drawer-actions">
        <button className="btn btn--primary" onClick={saveConfig} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn--ghost" onClick={test} disabled={testing || !config.slack_webhook_url}>
          <span className="material-symbols-outlined">send</span>
          {testing ? 'Testing…' : 'Test webhook'}
        </button>
      </div>
      {result && (
        <div className={`drawer-test__result ${result.success ? 'drawer-test__result--ok' : 'drawer-test__result--fail'}`}>
          {result.success ? '✓ Test message sent to Slack' : `✗ Failed — ${result.error}`}
        </div>
      )}
    </>
  );
}

// ─── Whitelist Drawer ──────────────────────────────────────────────────────────
function WhitelistDrawer({ onCountChange }) {
  const [entries,  setEntries]  = useState(null);
  const [type,     setType]     = useState('domain');
  const [value,    setValue]    = useState('');
  const [adding,   setAdding]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [err,      setErr]      = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  function load() {
    api.get('/whitelist').then(r => {
      setEntries(r.data);
      onCountChange?.(r.data.length);
    }).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setErr('');
    if (!value.trim()) return;
    setAdding(true);
    try {
      await api.post('/whitelist', { type, value: value.trim() });
      setValue('');
      showToast('Added');
      load();
    } catch (er) {
      setErr(er.response?.data?.error || 'Failed to add entry');
    } finally { setAdding(false); }
  }

  async function handleRemove(id) {
    try {
      await api.delete(`/whitelist/${id}`);
      showToast('Removed');
      load();
    } catch { setErr('Failed to remove entry'); }
  }

  if (!entries) return <div className="drawer-loading">Loading…</div>;

  return (
    <>
      {toast && <div className="drawer-toast drawer-toast--success">{toast}</div>}

      <div className="drawer-section">
        <h4 className="drawer-section__title">How it works</h4>
        <p className="drawer-section__desc">
          When at least one entry is present, only emails from listed addresses or domains will create tickets.
          If the list is empty, all senders are accepted.
        </p>
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">Add entry</h4>
        {err && <p className="drawer-section__error">{err}</p>}
        <form className="whitelist-add-form" onSubmit={handleAdd}>
          <select className="form-select whitelist-add-form__type" value={type} onChange={e => setType(e.target.value)}>
            <option value="domain">Domain</option>
            <option value="email">Email</option>
          </select>
          <input
            className="form-input whitelist-add-form__value"
            placeholder={type === 'domain' ? 'hospital.com' : 'user@hospital.com'}
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <button className="btn btn--primary btn--sm" type="submit" disabled={adding || !value.trim()}>
            {adding ? '…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="drawer-section">
        <h4 className="drawer-section__title">
          Current list
          {entries.length > 0 && <span className="whitelist-count">{entries.length}</span>}
        </h4>
        {entries.length === 0 ? (
          <p className="drawer-section__desc">No entries — all inbound senders are currently accepted.</p>
        ) : (
          <div className="whitelist-list">
            {entries.map(e => (
              <div key={e.id} className="whitelist-item">
                <span className={`whitelist-item__badge whitelist-item__badge--${e.type}`}>{e.type}</span>
                <span className="whitelist-item__value">{e.value}</span>
                <button type="button" className="whitelist-item__remove" title="Remove"
                  onClick={() => handleRemove(e.id)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
