import { SiftBookmark } from '../utils/types';

export async function getLastVisit(url: string): Promise<number | undefined> {
  const visits = await chrome.history.getVisits({ url });
  if (visits.length === 0) {
    return undefined;
  }
  // Return the most recent visit time
  return Math.max(...visits.map((v) => v.visitTime || 0));
}

export async function enrichBookmarksWithVisits(
  bookmarks: SiftBookmark[]
): Promise<SiftBookmark[]> {
  const enriched: SiftBookmark[] = [];

  for (const bookmark of bookmarks) {
    const lastVisited = await getLastVisit(bookmark.url);
    enriched.push({
      ...bookmark,
      lastVisited,
    });
  }

  return enriched;
}

export async function getStaleBookmarks(
  bookmarks: SiftBookmark[],
  thresholdDays: number
): Promise<SiftBookmark[]> {
  const threshold = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  const stale: SiftBookmark[] = [];

  for (const bookmark of bookmarks) {
    const lastVisited = await getLastVisit(bookmark.url);
    if (!lastVisited || lastVisited < threshold) {
      stale.push({
        ...bookmark,
        lastVisited,
      });
    }
  }

  return stale;
}
