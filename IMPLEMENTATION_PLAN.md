# Sift Implementation Plan

## Overview
Chrome extension (Manifest V3) for AI-powered bookmark management using TypeScript, Preact, and Claude Haiku 4.5.

---

## Architecture

```
sift/
├── src/
│   ├── background/          # Service worker
│   │   └── index.ts
│   ├── popup/               # Main UI (Preact)
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── components/
│   │       ├── Dashboard.tsx
│   │       ├── BookmarkTree.tsx
│   │       ├── SearchResults.tsx
│   │       └── ActionPanel.tsx
│   ├── options/             # Settings page
│   │   └── index.tsx
│   ├── services/
│   │   ├── bookmarks.ts     # Chrome bookmarks API wrapper
│   │   ├── history.ts       # Chrome history API (for stale detection)
│   │   ├── health.ts        # Health score calculator
│   │   ├── linkChecker.ts   # Dead link detection
│   │   ├── ai.ts            # Claude API integration
│   │   └── storage.ts       # Chrome storage wrapper
│   ├── utils/
│   │   ├── duplicates.ts    # URL normalization & duplicate detection
│   │   ├── sorting.ts       # Recursive folder sorting
│   │   └── types.ts         # TypeScript interfaces
│   └── manifest.json
├── dist/                    # Build output
├── package.json
├── tsconfig.json
└── vite.config.ts           # Bundler config
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
- Initialize npm project with TypeScript
- Configure Vite for Chrome extension bundling
- Create Manifest V3 configuration with required permissions:
  - `bookmarks` - read/write bookmarks
  - `history` - access visit data for stale detection
  - `storage` - persist API key and settings
  - `host_permissions` for link checking (HEAD requests)
- Set up Preact with TypeScript
- Create base service worker

### Phase 2: Bookmark Services
- **bookmarks.ts**: Wrap Chrome bookmarks API
  - `getAllBookmarks()` - flatten tree structure
  - `getFolderTree()` - get hierarchy
  - `createFolder()`, `moveBookmark()`, `deleteBookmark()`
  - `createSiftFolder(name?)` - create Sift/[name] structure
- **history.ts**: Wrap Chrome history API
  - `getLastVisit(url)` - for stale detection
- **storage.ts**: Secure storage for API key
  - Use `chrome.storage.local` (not synced, stays on device)

### Phase 3: Health Dashboard
- **health.ts**: Calculate health metrics
  - Total bookmarks/folders count
  - Duplicate detection (normalize URLs, compare)
  - Domain distribution analysis
  - Uncategorized items (bookmarks in root or generic folders)
  - Stale bookmark count (not visited in X days)
- **linkChecker.ts**: Dead link detection
  - Batch HEAD requests with rate limiting
  - Cache results to avoid repeated checks
  - Handle timeouts gracefully
- **Dashboard.tsx**: Visual health display
  - Health score (1-100) with color indicator
  - Breakdown cards for each metric
  - "Fix" action buttons for each issue type

### Phase 4: Core Operations
- **duplicates.ts**: Duplicate removal
  - URL normalization (strip tracking params, trailing slashes, etc.)
  - Group by normalized URL
  - Keep most recently visited, remove others
- **sorting.ts**: Recursive sorting
  - Sort folders first, then bookmarks
  - Alphabetical by title within each group
- Delete stale bookmarks
  - Query history for visit dates
  - Allow user to set threshold (days/date)
- Rename bookmarks (AI-assisted, see Phase 5)

### Phase 5: AI Integration
- **ai.ts**: Claude Haiku 4.5 integration
  - Secure API key handling (never exposed in content scripts)
  - All AI calls go through background service worker
  - Rate limiting and error handling
- **Categorization**:
  - Send batch of bookmark titles + URLs to Claude
  - Prompt: analyze and suggest logical folder structure
  - Present suggestions to user for approval
- **Renaming**:
  - For unclear bookmark titles, fetch page title or use AI
  - Batch processing for efficiency

### Phase 6: Reorganization & Output
- Create "Sift" root folder
- Create dated/named subfolder
- Copy reorganized bookmarks to new structure
- Preserve original bookmarks (non-destructive)

### Phase 7: Search & Filter
- Keyword search across bookmark titles and URLs
- Filter by domain, folder, date range
- Clickable results list with quick actions

---

## API Key Security

The Claude API key will be:
1. Stored in `chrome.storage.local` (device-only, not synced)
2. Only accessible from background service worker
3. Never passed to content scripts or popup directly
4. All AI requests proxied through background script via message passing

Options page will have a password-type input for the API key.

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bundler | Vite | Fast builds, good Chrome extension support |
| UI Framework | Preact | Lightweight (3KB), React-compatible |
| Manifest | V3 | Required for new extensions, more secure |
| State Management | Preact Signals | Simple, built-in reactivity |
| Styling | CSS Modules or Tailwind | Scoped styles, small bundle |

---

## Chrome Extension Permissions

```json
{
  "permissions": [
    "bookmarks",
    "history",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

`host_permissions` needed for HEAD requests to check dead links.

---

## Resolved Design Decisions

1. **Stale threshold**: Default 180 days, user-configurable via settings UI
2. **Dead link checking**: User-configurable (on-demand or automatic) via settings UI
3. **AI batch size**: ~50 bookmarks per request (balances context limits and API costs)
4. **UI type**: Popup-based UI

---

## Suggested Build Order

1. Phase 1-2: Get extension loading with basic bookmark reading
2. Phase 3: Health dashboard (visible progress, no AI yet)
3. Phase 4: Core operations (sorting, duplicates, stale removal)
4. Phase 5-6: AI integration and reorganization
5. Phase 7: Search/filter (polish feature)

Ready to proceed when you approve or provide feedback.
