import { vi } from 'vitest';

// Mock bookmark data
export const mockBookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        parentId: '0',
        children: [
          {
            id: '10',
            title: 'Example',
            url: 'https://example.com',
            parentId: '1',
            dateAdded: Date.now() - 86400000,
          },
          {
            id: '11',
            title: 'Duplicate Example',
            url: 'https://www.example.com/',
            parentId: '1',
            dateAdded: Date.now() - 172800000,
          },
          {
            id: '12',
            title: 'Tech Folder',
            parentId: '1',
            children: [
              {
                id: '120',
                title: 'GitHub',
                url: 'https://github.com',
                parentId: '12',
                dateAdded: Date.now(),
              },
            ],
          },
        ],
      },
      {
        id: '2',
        title: 'Other Bookmarks',
        parentId: '0',
        children: [],
      },
    ],
  },
];

// Mock history visits
export const mockVisits: Record<string, chrome.history.VisitItem[]> = {
  'https://example.com': [
    { id: '1', visitId: '1', visitTime: Date.now() - 200 * 24 * 60 * 60 * 1000, transition: 'link', referringVisitId: '0' },
  ],
  'https://www.example.com/': [
    { id: '2', visitId: '2', visitTime: Date.now() - 10 * 24 * 60 * 60 * 1000, transition: 'link', referringVisitId: '0' },
  ],
  'https://github.com': [
    { id: '3', visitId: '3', visitTime: Date.now() - 1 * 24 * 60 * 60 * 1000, transition: 'link', referringVisitId: '0' },
  ],
};

// Mock settings
let mockSettings = {
  staleThresholdDays: 180,
  autoCheckDeadLinks: false,
  claudeApiKey: '',
};

export function setupChromeMocks() {
  const chrome = {
    bookmarks: {
      getTree: vi.fn().mockResolvedValue(mockBookmarkTree),
      getChildren: vi.fn().mockImplementation((id: string) => {
        function findNode(nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode | undefined {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findNode(node.children);
              if (found) return found;
            }
          }
          return undefined;
        }
        const node = findNode(mockBookmarkTree);
        return Promise.resolve(node?.children || []);
      }),
      create: vi.fn().mockImplementation((bookmark) =>
        Promise.resolve({ id: String(Math.random()), ...bookmark })
      ),
      move: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
      removeTree: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockImplementation((id, changes) =>
        Promise.resolve({ id, ...changes })
      ),
      search: vi.fn().mockImplementation((query: string) => {
        const results: chrome.bookmarks.BookmarkTreeNode[] = [];
        function search(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
          for (const node of nodes) {
            if (node.url && (node.title.toLowerCase().includes(query.toLowerCase()) ||
                node.url.toLowerCase().includes(query.toLowerCase()))) {
              results.push(node);
            }
            if (node.children) search(node.children);
          }
        }
        search(mockBookmarkTree);
        return Promise.resolve(results);
      }),
    },
    history: {
      getVisits: vi.fn().mockImplementation(({ url }: { url: string }) => {
        return Promise.resolve(mockVisits[url] || []);
      }),
    },
    storage: {
      local: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'sift_settings') {
            return Promise.resolve({ sift_settings: mockSettings });
          }
          return Promise.resolve({});
        }),
        set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          if (data.sift_settings) {
            mockSettings = { ...mockSettings, ...(data.sift_settings as typeof mockSettings) };
          }
          return Promise.resolve();
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
      openOptionsPage: vi.fn(),
    },
  };

  // @ts-expect-error - mocking global chrome
  globalThis.chrome = chrome;

  return chrome;
}

export function resetMockSettings() {
  mockSettings = {
    staleThresholdDays: 180,
    autoCheckDeadLinks: false,
    claudeApiKey: '',
  };
}
