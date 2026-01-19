import { describe, it, expect } from 'vitest';
import { getAllBookmarks, getAllFolders, searchBookmarks } from './bookmarks';

describe('bookmarks service', () => {
  describe('getAllBookmarks', () => {
    it('returns all bookmarks from the tree', async () => {
      const bookmarks = await getAllBookmarks();

      expect(bookmarks.length).toBeGreaterThan(0);
      expect(bookmarks.every((b) => b.url)).toBe(true);
    });

    it('includes bookmark metadata', async () => {
      const bookmarks = await getAllBookmarks();
      const example = bookmarks.find((b) => b.title === 'Example');

      expect(example).toBeDefined();
      expect(example?.url).toBe('https://example.com');
      expect(example?.parentId).toBe('1');
    });

    it('flattens nested bookmarks', async () => {
      const bookmarks = await getAllBookmarks();
      const github = bookmarks.find((b) => b.title === 'GitHub');

      expect(github).toBeDefined();
      expect(github?.url).toBe('https://github.com');
    });
  });

  describe('getAllFolders', () => {
    it('returns all folders', async () => {
      const folders = await getAllFolders();

      expect(folders.length).toBeGreaterThan(0);
      expect(folders.every((f) => !f.id.startsWith('http'))).toBe(true);
    });

    it('includes bookmark bar folder', async () => {
      const folders = await getAllFolders();
      const bookmarksBar = folders.find((f) => f.title === 'Bookmarks Bar');

      expect(bookmarksBar).toBeDefined();
    });

    it('includes nested folders', async () => {
      const folders = await getAllFolders();
      const techFolder = folders.find((f) => f.title === 'Tech Folder');

      expect(techFolder).toBeDefined();
    });
  });

  describe('searchBookmarks', () => {
    it('finds bookmarks by title', async () => {
      const results = await searchBookmarks('GitHub');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('GitHub');
    });

    it('finds bookmarks by URL', async () => {
      const results = await searchBookmarks('example.com');

      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for no matches', async () => {
      const results = await searchBookmarks('nonexistent-query-xyz');

      expect(results).toHaveLength(0);
    });
  });
});
