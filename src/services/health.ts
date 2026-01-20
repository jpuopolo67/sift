import { SiftBookmark, HealthMetrics, DomainCount } from '../utils/types';
import { findDuplicates } from '../utils/duplicates';
import { getAllBookmarks, getAllFolders } from './bookmarks';
import { getStaleBookmarks } from './history';
import { findDeadLinks } from './linkChecker';
import { getSettings, getDeadLinkCache } from './storage';

// Root folder IDs that indicate uncategorized bookmarks
const ROOT_FOLDER_IDS = ['0', '1', '2']; // Root, Bookmarks Bar, Other Bookmarks

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return 'unknown';
  }
}

function calculateDomainDistribution(bookmarks: SiftBookmark[]): DomainCount[] {
  const domainCounts = new Map<string, number>();

  for (const bookmark of bookmarks) {
    const domain = extractDomain(bookmark.url);
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  const total = bookmarks.length;
  const distribution: DomainCount[] = [];

  for (const [domain, count] of domainCounts.entries()) {
    distribution.push({
      domain,
      count,
      percentage: Math.round((count / total) * 100),
    });
  }

  // Sort by count descending
  distribution.sort((a, b) => b.count - a.count);

  return distribution;
}

function countUncategorized(bookmarks: SiftBookmark[]): number {
  return bookmarks.filter((b) => ROOT_FOLDER_IDS.includes(b.parentId || '')).length;
}

function calculateHealthScore(metrics: Omit<HealthMetrics, 'healthScore'>): number {
  let score = 100;

  // Deduct for duplicates (up to 20 points)
  const duplicateCount = metrics.duplicates.reduce(
    (sum, g) => sum + g.bookmarks.length - 1,
    0
  );
  const duplicateRatio = duplicateCount / Math.max(metrics.totalBookmarks, 1);
  score -= Math.min(20, Math.round(duplicateRatio * 100));

  // Deduct for dead links (up to 25 points)
  const deadLinkRatio = metrics.deadLinks.length / Math.max(metrics.totalBookmarks, 1);
  score -= Math.min(25, Math.round(deadLinkRatio * 100));

  // Deduct for stale bookmarks (up to 15 points)
  const staleRatio = metrics.staleBookmarks.length / Math.max(metrics.totalBookmarks, 1);
  score -= Math.min(15, Math.round(staleRatio * 50));

  // Deduct for uncategorized bookmarks (up to 15 points)
  const uncategorizedRatio = metrics.uncategorizedCount / Math.max(metrics.totalBookmarks, 1);
  score -= Math.min(15, Math.round(uncategorizedRatio * 30));

  // Deduct for domain concentration (up to 10 points)
  if (metrics.domainDistribution.length > 0) {
    const topDomainPercentage = metrics.domainDistribution[0].percentage;
    if (topDomainPercentage > 30) {
      score -= Math.min(10, Math.round((topDomainPercentage - 30) / 7));
    }
  }

  // Deduct for low folder organization (up to 15 points)
  const bookmarksPerFolder = metrics.totalBookmarks / Math.max(metrics.totalFolders, 1);
  if (bookmarksPerFolder > 50) {
    score -= Math.min(15, Math.round((bookmarksPerFolder - 50) / 10));
  }

  return Math.max(1, Math.min(100, score));
}

export async function calculateHealthMetrics(
  checkDeadLinks: boolean = false
): Promise<HealthMetrics> {
  const settings = await getSettings();
  const bookmarks = await getAllBookmarks();
  const folders = await getAllFolders();

  const duplicates = findDuplicates(bookmarks);
  const staleBookmarks = await getStaleBookmarks(bookmarks, settings.staleThresholdDays);
  const uncategorizedCount = countUncategorized(bookmarks);
  const domainDistribution = calculateDomainDistribution(bookmarks);

  // Dead link checking is optional due to time cost
  let deadLinks: SiftBookmark[] = [];
  if (checkDeadLinks) {
    deadLinks = await findDeadLinks(bookmarks);
  } else {
    // If not checking live, use cached results
    const cache = await getDeadLinkCache();
    deadLinks = bookmarks.filter(b => cache[b.url]?.status === 'dead');
  }

  const partialMetrics = {
    totalBookmarks: bookmarks.length,
    totalFolders: folders.length,
    duplicates,
    deadLinks,
    staleBookmarks,
    uncategorizedCount,
    domainDistribution,
  };

  return {
    ...partialMetrics,
    healthScore: calculateHealthScore(partialMetrics),
  };
}
