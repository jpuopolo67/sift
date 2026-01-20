import { MessageType, SiftBookmark, DuplicateGroup, DeadLinkCheckState, DEFAULT_DEAD_LINK_CHECK_STATE, DeadLinkCacheEntry, CategorizationState, DEFAULT_CATEGORIZATION_STATE, CategorySuggestion } from '../utils/types';
import {
  getAllBookmarks,
  searchBookmarks,
  sortAllFolders,
  createSiftFolder,
  deleteBookmark,
  createFolder,
  createBookmark,
  getBookmarkPaths,
} from '../services/bookmarks';
import { calculateHealthMetrics } from '../services/health';
import { checkLinks, filterBookmarksToCheck } from '../services/linkChecker';
import { suggestCategories, suggestRenames } from '../services/ai';
import { getSettings, saveSettings, getDeadLinkCache, updateDeadLinkCacheEntries } from '../services/storage';
import { selectBookmarkToKeep } from '../utils/duplicates';

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case 'GET_BOOKMARKS':
      return getAllBookmarks();

    case 'GET_HEALTH_METRICS':
      const settings = await getSettings();

      // Trigger background check if enabled and needed (respects threshold)
      if (settings.autoCheckDeadLinks) {
        startDeadLinkCheck().catch((err) => console.error('Failed to auto-start dead link check:', err));
      }

      // Pass false to use cached results immediatey while check runs in background
      return calculateHealthMetrics(false);

    case 'GET_BOOKMARK_PATHS':
      return getBookmarkPaths(message.bookmarkIds);

    case 'CHECK_LINKS':
      return checkLinks(message.urls);

    case 'CATEGORIZE_BOOKMARKS':
      return suggestCategories(message.bookmarks);

    case 'SUGGEST_RENAMES':
      return suggestRenames(message.bookmarks);

    case 'REMOVE_DUPLICATES':
      return removeDuplicates(message.groups);

    case 'DELETE_STALE':
      return deleteStaleBookmarks(message.bookmarks);

    case 'DELETE_DEAD_LINKS':
      return deleteDeadLinks(message.bookmarks);

    case 'SORT_BOOKMARKS':
      await sortAllFolders();
      return { success: true };

    case 'CREATE_SIFT_FOLDER':
      return createSiftFolder();

    case 'SEARCH_BOOKMARKS':
      return searchBookmarks(message.query);

    case 'GET_SETTINGS':
      return getSettings();

    case 'SAVE_SETTINGS':
      return saveSettings(message.settings);

    case 'START_DEAD_LINK_CHECK':
      return startDeadLinkCheck();

    case 'GET_DEAD_LINK_CHECK_STATUS':
      return getDeadLinkCheckStatus();

    case 'CANCEL_DEAD_LINK_CHECK':
      return cancelDeadLinkCheck();

    case 'CLEAR_DEAD_LINK_RESULTS':
      return clearDeadLinkResults();

    case 'START_CATEGORIZATION':
      return startCategorization();

    case 'GET_CATEGORIZATION_STATUS':
      return getCategorizationStatus();

    case 'CANCEL_CATEGORIZATION':
      return cancelCategorization();

    case 'CLEAR_CATEGORIZATION_RESULTS':
      return clearCategorizationResults();

    default:
      throw new Error(`Unknown message type`);
  }
}

async function removeDuplicates(groups: DuplicateGroup[]): Promise<{ removed: number }> {
  let removed = 0;

  for (const group of groups) {
    const keep = selectBookmarkToKeep(group);
    for (const bookmark of group.bookmarks) {
      if (bookmark.id !== keep.id) {
        await deleteBookmark(bookmark.id);
        removed++;
      }
    }
  }

  return { removed };
}

async function deleteStaleBookmarks(bookmarks: SiftBookmark[]): Promise<{ deleted: number }> {
  let deleted = 0;

  for (const bookmark of bookmarks) {
    await deleteBookmark(bookmark.id);
    deleted++;
  }

  return { deleted };
}

async function deleteDeadLinks(bookmarks: SiftBookmark[]): Promise<{ deleted: number }> {
  let deleted = 0;

  for (const bookmark of bookmarks) {
    await deleteBookmark(bookmark.id);
    deleted++;
  }

  return { deleted };
}

async function reorganizeBookmarks(
  categories: CategorySuggestion[],
  onProgress?: (categoriesCreated: number, bookmarksCopied: number) => Promise<void>
): Promise<{ created: number; folderName: string }> {
  const { folder: siftFolder, folderName } = await createSiftFolder();
  let created = 0;
  let categoriesCreated = 0;

  for (const category of categories) {
    // Check if cancelled
    if (categorizationCancelled) {
      return { created, folderName };
    }

    const categoryFolder = await createFolder(category.folderName, siftFolder.id);
    categoriesCreated++;

    for (const bookmark of category.bookmarks) {
      // Check if cancelled
      if (categorizationCancelled) {
        return { created, folderName };
      }

      await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
      created++;

      // Report progress
      if (onProgress) {
        await onProgress(categoriesCreated, created);
      }
    }
  }

  return { created, folderName };
}

// Dead link check storage key
const DEAD_LINK_CHECK_KEY = 'deadLinkCheckState';

// Flag to track if check should be cancelled
let checkCancelled = false;

async function getDeadLinkCheckStatus(): Promise<DeadLinkCheckState> {
  const result = await chrome.storage.local.get(DEAD_LINK_CHECK_KEY);
  return result[DEAD_LINK_CHECK_KEY] || DEFAULT_DEAD_LINK_CHECK_STATE;
}

async function saveDeadLinkCheckState(state: DeadLinkCheckState): Promise<void> {
  await chrome.storage.local.set({ [DEAD_LINK_CHECK_KEY]: state });
}

async function clearDeadLinkResults(): Promise<{ success: boolean }> {
  await saveDeadLinkCheckState(DEFAULT_DEAD_LINK_CHECK_STATE);
  return { success: true };
}

async function cancelDeadLinkCheck(): Promise<{ success: boolean }> {
  checkCancelled = true;
  const state = await getDeadLinkCheckStatus();
  if (state.status === 'running') {
    await saveDeadLinkCheckState({
      ...state,
      status: 'cancelled',
      completedAt: Date.now(),
    });
  }
  return { success: true };
}

async function startDeadLinkCheck(): Promise<{ started: boolean; message?: string; skipped?: number }> {
  // Check if already running
  const currentState = await getDeadLinkCheckStatus();
  if (currentState.status === 'running') {
    return { started: false, message: 'Check already in progress' };
  }

  // Reset cancel flag
  checkCancelled = false;

  // Get settings and cache
  const settings = await getSettings();
  const cache = await getDeadLinkCache();

  // Get all bookmarks
  const allBookmarks = await getAllBookmarks();

  // Filter bookmarks based on cache - only check those not recently checked
  const { bookmarksToCheck, cachedDeadLinks } = filterBookmarksToCheck(
    allBookmarks,
    cache,
    settings.deadLinkRefreshDays
  );

  const skipped = allBookmarks.length - bookmarksToCheck.length;

  // Initialize state
  const initialState: DeadLinkCheckState = {
    status: 'running',
    checked: 0,
    total: bookmarksToCheck.length,
    deadLinks: [...cachedDeadLinks], // Start with cached dead links
    startedAt: Date.now(),
  };
  await saveDeadLinkCheckState(initialState);

  // Start the check in the background (don't await)
  runDeadLinkCheck(bookmarksToCheck, cachedDeadLinks).catch((error) => {
    console.error('Dead link check error:', error);
    getDeadLinkCheckStatus().then((state) => {
      saveDeadLinkCheckState({
        ...state,
        status: 'completed',
        error: error.message,
        completedAt: Date.now(),
      });
    });
  });

  return { started: true, skipped };
}

async function runDeadLinkCheck(bookmarks: SiftBookmark[], cachedDeadLinks: SiftBookmark[]): Promise<void> {
  const BATCH_SIZE = 10;
  const newDeadLinks: SiftBookmark[] = [];
  const allDeadLinks = [...cachedDeadLinks]; // Include cached dead links in total

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    // Check if cancelled
    if (checkCancelled) {
      return;
    }

    const batch = bookmarks.slice(i, i + BATCH_SIZE);
    const urls = batch.map((b) => b.url);

    try {
      const results = await checkLinks(urls);

      // Build cache entries for this batch
      const cacheEntries: Record<string, DeadLinkCacheEntry> = {};
      const now = Date.now();

      // Match results back to bookmarks and update cache
      results.forEach((result, idx) => {
        const bookmark = batch[idx];
        cacheEntries[bookmark.url] = {
          lastChecked: now,
          status: result.status,
        };
        if (result.status === 'dead') {
          newDeadLinks.push(bookmark);
          allDeadLinks.push(bookmark);
        }
      });

      // Update cache with this batch's results
      await updateDeadLinkCacheEntries(cacheEntries);
    } catch (error) {
      console.error('Batch check error:', error);
      // Continue with next batch on error
    }

    // Update progress in storage
    const checked = Math.min(i + BATCH_SIZE, bookmarks.length);
    await saveDeadLinkCheckState({
      status: 'running',
      checked,
      total: bookmarks.length,
      deadLinks: [...allDeadLinks],
      startedAt: (await getDeadLinkCheckStatus()).startedAt,
    });
  }

  // Check wasn't cancelled, so mark as completed
  if (!checkCancelled) {
    const totalChecked = bookmarks.length;
    const finalState: DeadLinkCheckState = {
      status: 'completed',
      checked: totalChecked,
      total: totalChecked,
      deadLinks: allDeadLinks,
      startedAt: (await getDeadLinkCheckStatus()).startedAt,
      completedAt: Date.now(),
    };
    await saveDeadLinkCheckState(finalState);

    // Send notification
    const message = allDeadLinks.length > 0
      ? `Found ${allDeadLinks.length} dead link${allDeadLinks.length === 1 ? '' : 's'} (${newDeadLinks.length} new, ${cachedDeadLinks.length} cached).`
      : `All ${totalChecked} bookmarks checked are working!`;
    chrome.notifications.create({
      type: 'basic',
      title: 'Sift - Dead Link Check Complete',
      message,
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
  }
}

// Categorization state storage key
const CATEGORIZATION_KEY = 'categorizationState';

// Flag to track if categorization should be cancelled
let categorizationCancelled = false;

async function getCategorizationStatus(): Promise<CategorizationState> {
  const result = await chrome.storage.local.get(CATEGORIZATION_KEY);
  return result[CATEGORIZATION_KEY] || DEFAULT_CATEGORIZATION_STATE;
}

async function saveCategorizationState(state: CategorizationState): Promise<void> {
  await chrome.storage.local.set({ [CATEGORIZATION_KEY]: state });
}

async function clearCategorizationResults(): Promise<{ success: boolean }> {
  await saveCategorizationState(DEFAULT_CATEGORIZATION_STATE);
  return { success: true };
}

async function cancelCategorization(): Promise<{ success: boolean }> {
  categorizationCancelled = true;
  const state = await getCategorizationStatus();
  if (state.status === 'running') {
    await saveCategorizationState({
      ...state,
      status: 'cancelled',
      completedAt: Date.now(),
    });
  }
  return { success: true };
}

async function startCategorization(): Promise<{ started: boolean; message?: string }> {
  // Check if already running
  const currentState = await getCategorizationStatus();
  if (currentState.status === 'running') {
    return { started: false, message: 'Categorization already in progress' };
  }

  // Reset cancel flag
  categorizationCancelled = false;

  // Get all bookmarks
  const allBookmarks = await getAllBookmarks();

  if (allBookmarks.length === 0) {
    return { started: false, message: 'No bookmarks to categorize' };
  }

  const MAX_BOOKMARKS_PER_REQUEST = 50;
  const totalBatches = Math.ceil(allBookmarks.length / MAX_BOOKMARKS_PER_REQUEST);

  // Initialize state
  const initialState: CategorizationState = {
    status: 'running',
    phase: 'fetching',
    currentBatch: 0,
    totalBatches,
    categoriesCreated: 0,
    bookmarksCopied: 0,
    totalBookmarks: allBookmarks.length,
    startedAt: Date.now(),
  };
  await saveCategorizationState(initialState);

  // Start the categorization in the background (don't await)
  runCategorization(allBookmarks).catch((error) => {
    console.error('Categorization error:', error);
    getCategorizationStatus().then((state) => {
      saveCategorizationState({
        ...state,
        status: 'completed',
        phase: 'done',
        error: error.message,
        completedAt: Date.now(),
      });
    });
  });

  return { started: true };
}

async function runCategorization(bookmarks: SiftBookmark[]): Promise<void> {
  const MAX_BOOKMARKS_PER_REQUEST = 50;
  const totalBatches = Math.ceil(bookmarks.length / MAX_BOOKMARKS_PER_REQUEST);
  const allCategories: CategorySuggestion[] = [];

  // Phase 1: Analyze bookmarks with AI in batches
  await saveCategorizationState({
    ...(await getCategorizationStatus()),
    phase: 'analyzing',
  });

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    // Check if cancelled
    if (categorizationCancelled) {
      return;
    }

    const start = batchIdx * MAX_BOOKMARKS_PER_REQUEST;
    const batch = bookmarks.slice(start, start + MAX_BOOKMARKS_PER_REQUEST);

    try {
      const suggestions = await suggestCategories(batch);

      // Merge suggestions into allCategories
      for (const suggestion of suggestions) {
        const existing = allCategories.find(c => c.folderName === suggestion.folderName);
        if (existing) {
          existing.bookmarks.push(...suggestion.bookmarks);
        } else {
          allCategories.push({ ...suggestion });
        }
      }
    } catch (error) {
      console.error('Batch categorization error:', error);
      // Continue with next batch on error
    }

    // Update progress
    await saveCategorizationState({
      ...(await getCategorizationStatus()),
      currentBatch: batchIdx + 1,
    });
  }

  // Check if cancelled before creating folders
  if (categorizationCancelled) {
    return;
  }

  // Phase 2: Create folders and copy bookmarks
  await saveCategorizationState({
    ...(await getCategorizationStatus()),
    phase: 'creating',
    currentBatch: totalBatches,
  });

  const { created, folderName } = await reorganizeBookmarks(
    allCategories,
    async (categoriesCreated, bookmarksCopied) => {
      await saveCategorizationState({
        ...(await getCategorizationStatus()),
        categoriesCreated,
        bookmarksCopied,
      });
    }
  );

  // Check wasn't cancelled, so mark as completed
  if (!categorizationCancelled) {
    const finalState: CategorizationState = {
      status: 'completed',
      phase: 'done',
      currentBatch: totalBatches,
      totalBatches,
      categoriesCreated: allCategories.length,
      bookmarksCopied: created,
      totalBookmarks: bookmarks.length,
      startedAt: (await getCategorizationStatus()).startedAt,
      completedAt: Date.now(),
      siftFolderName: folderName,
    };
    await saveCategorizationState(finalState);

    // Send notification
    chrome.notifications.create({
      type: 'basic',
      title: 'Sift - Categorization Complete',
      message: `Created ${allCategories.length} categories with ${created} bookmarks in Sift/${folderName}`,
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
  }
}

// Export for potential direct use
export { reorganizeBookmarks };
