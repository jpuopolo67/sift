import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings, getApiKey, setApiKey } from './storage';
import { DEFAULT_SETTINGS } from '../utils/types';

describe('storage service', () => {
  describe('getSettings', () => {
    it('returns default settings when none saved', async () => {
      const settings = await getSettings();

      expect(settings.staleThresholdDays).toBe(DEFAULT_SETTINGS.staleThresholdDays);
      expect(settings.autoCheckDeadLinks).toBe(DEFAULT_SETTINGS.autoCheckDeadLinks);
      expect(settings.claudeApiKey).toBe(DEFAULT_SETTINGS.claudeApiKey);
    });
  });

  describe('saveSettings', () => {
    it('saves and retrieves settings', async () => {
      await saveSettings({ staleThresholdDays: 90 });
      const settings = await getSettings();

      expect(settings.staleThresholdDays).toBe(90);
    });

    it('merges with existing settings', async () => {
      await saveSettings({ staleThresholdDays: 90 });
      await saveSettings({ autoCheckDeadLinks: true });
      const settings = await getSettings();

      expect(settings.staleThresholdDays).toBe(90);
      expect(settings.autoCheckDeadLinks).toBe(true);
    });
  });

  describe('API key management', () => {
    it('stores and retrieves API key', async () => {
      await setApiKey('sk-test-key');
      const key = await getApiKey();

      expect(key).toBe('sk-test-key');
    });

    it('returns empty string when no key set', async () => {
      const key = await getApiKey();

      expect(key).toBe('');
    });
  });
});
