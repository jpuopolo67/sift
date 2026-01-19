import { SiftSettings, DEFAULT_SETTINGS, DeadLinkCache, DeadLinkCacheEntry } from '../utils/types';

const SETTINGS_KEY = 'sift_settings';
const DEAD_LINK_CACHE_KEY = 'dead_link_cache';

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

// Dead link cache functions
export async function getDeadLinkCache(): Promise<DeadLinkCache> {
  const result = await chrome.storage.local.get(DEAD_LINK_CACHE_KEY);
  return result[DEAD_LINK_CACHE_KEY] || {};
}

export async function saveDeadLinkCache(cache: DeadLinkCache): Promise<void> {
  await chrome.storage.local.set({ [DEAD_LINK_CACHE_KEY]: cache });
}

export async function updateDeadLinkCacheEntry(
  url: string,
  entry: DeadLinkCacheEntry
): Promise<void> {
  const cache = await getDeadLinkCache();
  cache[url] = entry;
  await saveDeadLinkCache(cache);
}

export async function updateDeadLinkCacheEntries(
  entries: Record<string, DeadLinkCacheEntry>
): Promise<void> {
  const cache = await getDeadLinkCache();
  Object.assign(cache, entries);
  await saveDeadLinkCache(cache);
}

export async function clearDeadLinkCache(): Promise<void> {
  await chrome.storage.local.remove(DEAD_LINK_CACHE_KEY);
}
