import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Settings.css';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function saveSetting(key, value) {
    setSavingKey(key);
    try {
      const { data } = await api.patch(`/settings/${key}`, { value });
      setSettings(s => s.map(item => item.key === key ? { ...item, value: data.value } : item));
      showToast('Setting saved');
    } catch {
      showToast('Error saving setting');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <div className="settings-loading">Loading…</div>;

  return (
    <div className="settings-page">
      {toast && <div className="settings-toast">{toast}</div>}

      <div className="settings-section">
        <div className="settings-section__header">
          <h3>Application Settings</h3>
          <p className="settings-section__desc">
            {isAdmin ? 'Configure global application behavior.' : 'View-only. Admin access required to edit.'}
          </p>
        </div>

        <div className="settings-list">
          {settings.map(setting => (
            <SettingRow
              key={setting.key}
              setting={setting}
              onSave={saveSetting}
              saving={savingKey === setting.key}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ setting, onSave, saving, isAdmin }) {
  const [value, setValue] = useState(setting.value ?? '');
  const changed = value !== (setting.value ?? '');

  return (
    <div className="setting-row">
      <div className="setting-row__info">
        <div className="setting-row__key">{setting.key.replace(/_/g, ' ')}</div>
        {setting.description && (
          <div className="setting-row__desc">{setting.description}</div>
        )}
      </div>
      <div className="setting-row__control">
        <input
          className="form-input setting-row__input"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={!isAdmin}
        />
        {isAdmin && (
          <button
            className="btn btn--primary btn--sm"
            onClick={() => onSave(setting.key, value)}
            disabled={saving || !changed}
          >
            {saving ? '…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}
