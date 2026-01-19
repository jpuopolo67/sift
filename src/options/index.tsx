import { render, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { SiftSettings, DEFAULT_SETTINGS } from '../utils/types';

function Options() {
  const [settings, setSettings] = useState<SiftSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (result && !result.error) {
        setSettings(result);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  }

  async function saveSettings() {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  if (loading) {
    return <div style={styles.container}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Sift Settings</h1>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Stale Bookmark Detection</h2>
        <label style={styles.label}>
          <span>Days until bookmark is considered stale:</span>
          <input
            type="number"
            min="1"
            max="3650"
            value={settings.staleThresholdDays}
            onChange={(e) =>
              setSettings({
                ...settings,
                staleThresholdDays: parseInt((e.target as HTMLInputElement).value) || 180,
              })
            }
            style={styles.input}
          />
        </label>
        <p style={styles.hint}>
          Bookmarks not visited within this period will be flagged as stale. Default: 180 days.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Dead Link Checking</h2>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.autoCheckDeadLinks}
            onChange={(e) =>
              setSettings({
                ...settings,
                autoCheckDeadLinks: (e.target as HTMLInputElement).checked,
              })
            }
          />
          <span>Automatically check for dead links on dashboard load</span>
        </label>
        <p style={styles.hint}>
          When enabled, Sift will check all bookmark URLs for dead links automatically.
          This may slow down the initial dashboard load for large bookmark collections.
        </p>

        <label style={{ ...styles.label, marginTop: '16px' }}>
          <span>Refresh rate (days):</span>
          <input
            type="number"
            min="1"
            max="365"
            value={settings.deadLinkRefreshDays}
            onChange={(e) =>
              setSettings({
                ...settings,
                deadLinkRefreshDays: parseInt((e.target as HTMLInputElement).value) || 7,
              })
            }
            style={styles.input}
          />
        </label>
        <p style={styles.hint}>
          Only re-check links that haven't been checked within this many days.
          Links checked more recently will be skipped to speed up the process. Default: 7 days.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Claude API Key</h2>
        <label style={styles.label}>
          <span>API Key:</span>
          <input
            type="password"
            value={settings.claudeApiKey}
            onChange={(e) =>
              setSettings({
                ...settings,
                claudeApiKey: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="sk-ant-..."
            style={styles.input}
          />
        </label>
        <p style={styles.hint}>
          Required for AI-powered features (categorization, renaming suggestions).
          Get your API key from{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
            console.anthropic.com
          </a>
        </p>
      </div>

      <div style={styles.actions}>
        <button onClick={saveSettings} style={styles.button}>
          Save Settings
        </button>
        {saved && <span style={styles.savedMessage}>Settings saved!</span>}
      </div>
    </div>
  );
}

const styles: Record<string, JSX.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
    color: '#343a40',
  },
  section: {
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e9ecef',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#495057',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    fontSize: '14px',
    width: '100%',
    maxWidth: '300px',
  },
  hint: {
    fontSize: '12px',
    color: '#6c757d',
    marginTop: '8px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    background: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  savedMessage: {
    color: '#28a745',
    fontSize: '14px',
  },
};

render(<Options />, document.getElementById('app')!);
