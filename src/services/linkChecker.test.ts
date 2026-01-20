
import { describe, it, expect } from 'vitest';
import { filterBookmarksToCheck } from './linkChecker';
import { SiftBookmark, DeadLinkCache } from '../utils/types';

describe('filterBookmarksToCheck', () => {
    const mockBookmarks: SiftBookmark[] = [
        { id: '1', title: 'Fresh Alive', url: 'https://alive.com', dateAdded: Date.now() },
        { id: '2', title: 'Fresh Dead', url: 'https://dead.com', dateAdded: Date.now() },
        { id: '3', title: 'Stale Alive', url: 'https://stale-alive.com', dateAdded: Date.now() },
        { id: '4', title: 'Stale Dead', url: 'https://stale-dead.com', dateAdded: Date.now() },
        { id: '5', title: 'No Cache', url: 'https://new.com', dateAdded: Date.now() },
    ];

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const REFRESH_DAYS = 7;

    const mockCache: DeadLinkCache = {
        'https://alive.com': {
            lastChecked: now - (DAY_MS * 1), // 1 day ago (Fresh)
            status: 'alive',
        },
        'https://dead.com': {
            lastChecked: now - (DAY_MS * 1), // 1 day ago (Fresh)
            status: 'dead',
        },
        'https://stale-alive.com': {
            lastChecked: now - (DAY_MS * 10), // 10 days ago (Stale)
            status: 'alive',
        },
        'https://stale-dead.com': {
            lastChecked: now - (DAY_MS * 10), // 10 days ago (Stale)
            status: 'dead',
        },
        // No entry for https://new.com
    };

    it('should skip fresh bookmarks and check stale/new ones', () => {
        const { bookmarksToCheck, cachedDeadLinks } = filterBookmarksToCheck(
            mockBookmarks,
            mockCache,
            REFRESH_DAYS
        );

        // Fresh Alive -> Skipped (not in check list, not in dead list)
        expect(bookmarksToCheck.find(b => b.id === '1')).toBeUndefined();
        expect(cachedDeadLinks.find(b => b.id === '1')).toBeUndefined();

        // Fresh Dead -> Skipped check, but included in dead links
        expect(bookmarksToCheck.find(b => b.id === '2')).toBeUndefined();
        expect(cachedDeadLinks.find(b => b.id === '2')).toBeDefined();

        // Stale Alive -> Checked
        expect(bookmarksToCheck.find(b => b.id === '3')).toBeDefined();

        // Stale Dead -> Checked (to see if it's still dead)
        expect(bookmarksToCheck.find(b => b.id === '4')).toBeDefined();
        expect(cachedDeadLinks.find(b => b.id === '4')).toBeUndefined();

        // No Cache -> Checked
        expect(bookmarksToCheck.find(b => b.id === '5')).toBeDefined();

        expect(bookmarksToCheck).toHaveLength(3); // 3, 4, 5
        expect(cachedDeadLinks).toHaveLength(1); // 2
    });
});
