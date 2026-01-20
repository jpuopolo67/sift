import { SiftBookmark, DuplicateGroup } from './types';

// Common tracking parameters to strip
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'source',
  'mc_cid',
  'mc_eid',
];

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Normalize protocol: treat http and https as equivalent (use https as canonical)
    parsed.protocol = 'https:';

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Remove trailing slash from pathname
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Lowercase the host
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove www prefix
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    // Remove default ports
    parsed.port = '';

    // Sort query parameters for consistent comparison
    const sortedParams = new URLSearchParams(
      [...parsed.searchParams.entries()].sort()
    );
    parsed.search = sortedParams.toString() ? `?${sortedParams.toString()}` : '';

    // Remove hash/fragment
    parsed.hash = '';

    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url.toLowerCase();
  }
}

export function findDuplicates(bookmarks: SiftBookmark[]): DuplicateGroup[] {
  const urlMap = new Map<string, SiftBookmark[]>();

  for (const bookmark of bookmarks) {
    const normalized = normalizeUrl(bookmark.url);
    const existing = urlMap.get(normalized) || [];
    existing.push(bookmark);
    urlMap.set(normalized, existing);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [normalizedUrl, group] of urlMap.entries()) {
    if (group.length > 1) {
      duplicates.push({ normalizedUrl, bookmarks: group });
    }
  }

  return duplicates;
}

export function selectBookmarkToKeep(group: DuplicateGroup): SiftBookmark {
  // Keep the most recently created bookmark (dateAdded is the only timestamp Chrome provides)
  return group.bookmarks.reduce((best, current) => {
    const bestTime = best.dateAdded || 0;
    const currentTime = current.dateAdded || 0;
    return currentTime > bestTime ? current : best;
  });
}
