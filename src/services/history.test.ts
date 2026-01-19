import { describe, it, expect } from 'vitest';
import { getLastVisit, getStaleBookmarks } from './history';
import { SiftBookmark } from '../utils/types';

describe('history service', () => {
  describe('getLastVisit', () => {
    it('returns visit time for visited URL', async () => {
      const lastVisit = await getLastVisit('https://github.com');

      expect(lastVisit).toBeDefined();
      expect(typeof lastVisit).toBe('number');
    });

    it('returns undefined for never visited URL', async () => {
      const lastVisit = await getLastVisit('https://never-visited.com');

      expect(lastVisit).toBeUndefined();
    });
  });

  describe('getStaleBookmarks', () => {
    it('identifies stale bookmarks based on threshold', async () => {
      const bookmarks: SiftBookmark[] = [
        { id: '1', title: 'Stale', url: 'https://example.com' }, // visited 200 days ago
        { id: '2', title: 'Recent', url: 'https://github.com' }, // visited 1 day ago
      ];

      const stale = await getStaleBookmarks(bookmarks, 180);

      expect(stale.length).toBe(1);
      expect(stale[0].id).toBe('1');
    });

    it('marks never-visited bookmarks as stale', async () => {
      const bookmarks: SiftBookmark[] = [
        { id: '1', title: 'Never Visited', url: 'https://never-visited.com' },
      ];

      const stale = await getStaleBookmarks(bookmarks, 180);

      expect(stale.length).toBe(1);
    });

    it('returns empty array when all bookmarks are recent', async () => {
      const bookmarks: SiftBookmark[] = [
        { id: '1', title: 'Recent', url: 'https://github.com' },
      ];

      const stale = await getStaleBookmarks(bookmarks, 180);

      expect(stale.length).toBe(0);
    });

    it('respects custom threshold', async () => {
      const bookmarks: SiftBookmark[] = [
        { id: '1', title: 'Example', url: 'https://example.com' }, // visited 200 days ago
      ];

      // With 365-day threshold, 200 days is not stale
      const staleWith365 = await getStaleBookmarks(bookmarks, 365);
      expect(staleWith365.length).toBe(0);

      // With 30-day threshold, 200 days is stale
      const staleWith30 = await getStaleBookmarks(bookmarks, 30);
      expect(staleWith30.length).toBe(1);
    });
  });
});
