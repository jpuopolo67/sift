import { SiftSettings, DEFAULT_SETTINGS } from '../utils/types';

const SETTINGS_KEY = 'sift_settings';

export async function getSettings(): Promise<SiftSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(settings: Partial<SiftSettings>): Promise<SiftSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

export async function getApiKey(): Promise<string> {
  const settings = await getSettings();
  return settings.claudeApiKey;
}

export async function setApiKey(apiKey: string): Promise<void> {
  await saveSettings({ claudeApiKey: apiKey });
}
