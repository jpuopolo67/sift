export interface SiftBookmark {
  id: string;
  title: string;
  url: string;
  parentId?: string;
  dateAdded?: number;
  lastVisited?: number;
}

export interface SiftFolder {
  id: string;
  title: string;
  parentId?: string;
  children: (SiftFolder | SiftBookmark)[];
}

export interface HealthMetrics {
  totalBookmarks: number;
  totalFolders: number;
  duplicates: DuplicateGroup[];
  deadLinks: SiftBookmark[];
  staleBookmarks: SiftBookmark[];
  uncategorizedCount: number;
  domainDistribution: DomainCount[];
  healthScore: number;
}

export interface DuplicateGroup {
  normalizedUrl: string;
  bookmarks: SiftBookmark[];
}

export interface DomainCount {
  domain: string;
  count: number;
  percentage: number;
}

export interface LinkCheckResult {
  url: string;
  status: 'alive' | 'dead' | 'timeout' | 'error';
  statusCode?: number;
}

export interface SiftSettings {
  staleThresholdDays: number;
  autoCheckDeadLinks: boolean;
  deadLinkRefreshDays: number;
  claudeApiKey: string;
}

export const DEFAULT_SETTINGS: SiftSettings = {
  staleThresholdDays: 180,
  autoCheckDeadLinks: false,
  deadLinkRefreshDays: 7,
  claudeApiKey: '',
};

// Cache entry for dead link checking - stores last check time and result per URL
export interface DeadLinkCacheEntry {
  lastChecked: number; // timestamp
  status: 'alive' | 'dead' | 'timeout' | 'error';
}

// Map of URL to cache entry
export type DeadLinkCache = Record<string, DeadLinkCacheEntry>;

export interface CategorySuggestion {
  folderName: string;
  bookmarks: SiftBookmark[];
}

export interface RenameSuggestion {
  bookmark: SiftBookmark;
  suggestedTitle: string;
}

export interface DeadLinkCheckState {
  status: 'idle' | 'running' | 'completed' | 'cancelled';
  checked: number;
  total: number;
  deadLinks: SiftBookmark[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export const DEFAULT_DEAD_LINK_CHECK_STATE: DeadLinkCheckState = {
  status: 'idle',
  checked: 0,
  total: 0,
  deadLinks: [],
};

export type MessageType =
  | { type: 'GET_BOOKMARKS' }
  | { type: 'GET_HEALTH_METRICS' }
  | { type: 'GET_BOOKMARK_PATHS'; bookmarkIds: string[] }
  | { type: 'CHECK_LINKS'; urls: string[] }
  | { type: 'CATEGORIZE_BOOKMARKS'; bookmarks: SiftBookmark[] }
  | { type: 'SUGGEST_RENAMES'; bookmarks: SiftBookmark[] }
  | { type: 'REMOVE_DUPLICATES'; groups: DuplicateGroup[] }
  | { type: 'DELETE_STALE'; bookmarks: SiftBookmark[] }
  | { type: 'DELETE_DEAD_LINKS'; bookmarks: SiftBookmark[] }
  | { type: 'SORT_BOOKMARKS' }
  | { type: 'CREATE_SIFT_FOLDER'; name?: string }
  | { type: 'SEARCH_BOOKMARKS'; query: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<SiftSettings> }
  | { type: 'START_DEAD_LINK_CHECK' }
  | { type: 'GET_DEAD_LINK_CHECK_STATUS' }
  | { type: 'CANCEL_DEAD_LINK_CHECK' }
  | { type: 'CLEAR_DEAD_LINK_RESULTS' };
