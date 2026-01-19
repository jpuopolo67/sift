import { describe, it, expect } from 'vitest';
import { normalizeUrl, findDuplicates, selectBookmarkToKeep } from './duplicates';
import { SiftBookmark, DuplicateGroup } from './types';

describe('normalizeUrl', () => {
  it('removes tracking parameters', () => {
    const url = 'https://example.com/page?utm_source=twitter&utm_medium=social&id=123';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page?id=123');
  });

  it('removes all tracking params when only tracking params exist', () => {
    const url = 'https://example.com/page?utm_source=twitter&fbclid=abc';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page');
  });

  it('removes trailing slashes', () => {
    const url = 'https://example.com/page/';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page');
  });

  it('lowercases hostname', () => {
    const url = 'https://EXAMPLE.COM/Page';
    const normalized = normalizeUrl(url);
    expect(normalized).toContain('example.com');
  });

  it('removes www prefix', () => {
    const url = 'https://www.example.com/page';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page');
  });

  it('removes default https port', () => {
    const url = 'https://example.com:443/page';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page');
  });

  it('removes default http port', () => {
    const url = 'http://example.com:80/page';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('http://example.com/page');
  });

  it('sorts query parameters', () => {
    const url1 = 'https://example.com/page?b=2&a=1';
    const url2 = 'https://example.com/page?a=1&b=2';
    expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
  });

  it('removes hash/fragment', () => {
    const url = 'https://example.com/page#section';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/page');
  });

  it('handles invalid URLs gracefully', () => {
    const url = 'not-a-valid-url';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('not-a-valid-url');
  });
});

describe('findDuplicates', () => {
  it('finds bookmarks with same normalized URL', () => {
    const bookmarks: SiftBookmark[] = [
      { id: '1', title: 'Example', url: 'https://example.com/page' },
      { id: '2', title: 'Example Page', url: 'https://www.example.com/page/' },
      { id: '3', title: 'Other', url: 'https://other.com' },
    ];

    const duplicates = findDuplicates(bookmarks);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].bookmarks).toHaveLength(2);
    expect(duplicates[0].bookmarks.map((b) => b.id)).toContain('1');
    expect(duplicates[0].bookmarks.map((b) => b.id)).toContain('2');
  });

  it('returns empty array when no duplicates', () => {
    const bookmarks: SiftBookmark[] = [
      { id: '1', title: 'Example', url: 'https://example.com' },
      { id: '2', title: 'Other', url: 'https://other.com' },
    ];

    const duplicates = findDuplicates(bookmarks);
    expect(duplicates).toHaveLength(0);
  });

  it('groups multiple duplicates correctly', () => {
    const bookmarks: SiftBookmark[] = [
      { id: '1', title: 'A1', url: 'https://a.com' },
      { id: '2', title: 'A2', url: 'https://www.a.com/' },
      { id: '3', title: 'B1', url: 'https://b.com' },
      { id: '4', title: 'B2', url: 'https://b.com?utm_source=test' },
      { id: '5', title: 'C', url: 'https://c.com' },
    ];

    const duplicates = findDuplicates(bookmarks);

    expect(duplicates).toHaveLength(2);
  });

  it('handles bookmarks with tracking params as duplicates', () => {
    const bookmarks: SiftBookmark[] = [
      { id: '1', title: 'Article', url: 'https://news.com/article' },
      { id: '2', title: 'Article Shared', url: 'https://news.com/article?utm_source=twitter&utm_campaign=share' },
    ];

    const duplicates = findDuplicates(bookmarks);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].bookmarks).toHaveLength(2);
  });
});

describe('selectBookmarkToKeep', () => {
  it('keeps the most recently created bookmark', () => {
    const group: DuplicateGroup = {
      normalizedUrl: 'https://example.com',
      bookmarks: [
        { id: '1', title: 'Old', url: 'https://example.com', dateAdded: 1000 },
        { id: '2', title: 'New', url: 'https://example.com', dateAdded: 2000 },
      ],
    };

    const keep = selectBookmarkToKeep(group);
    expect(keep.id).toBe('2');
  });

  it('handles bookmarks without dateAdded', () => {
    const group: DuplicateGroup = {
      normalizedUrl: 'https://example.com',
      bookmarks: [
        { id: '1', title: 'No date', url: 'https://example.com' },
        { id: '2', title: 'Has date', url: 'https://example.com', dateAdded: 2000 },
      ],
    };

    const keep = selectBookmarkToKeep(group);
    expect(keep.id).toBe('2');
  });

  it('keeps first bookmark when all have same dateAdded', () => {
    const group: DuplicateGroup = {
      normalizedUrl: 'https://example.com',
      bookmarks: [
        { id: '1', title: 'First', url: 'https://example.com', dateAdded: 1000 },
        { id: '2', title: 'Second', url: 'https://example.com', dateAdded: 1000 },
      ],
    };

    const keep = selectBookmarkToKeep(group);
    // When equal, the first one is kept (reduce behavior)
    expect(keep.id).toBe('1');
  });
});
