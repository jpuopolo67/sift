import { MessageType, SiftBookmark, DuplicateGroup, DeadLinkCheckState, DEFAULT_DEAD_LINK_CHECK_STATE, DeadLinkCacheEntry } from '../utils/types';
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
      return createSiftFolder(message.name);

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
  categories: { folderName: string; bookmarks: SiftBookmark[] }[],
  targetFolderName?: string
): Promise<{ created: number }> {
  const siftFolder = await createSiftFolder(targetFolderName);
  let created = 0;

  for (const category of categories) {
    const categoryFolder = await createFolder(category.folderName, siftFolder.id);

    for (const bookmark of category.bookmarks) {
      await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
      created++;
    }
  }

  return { created };
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

// Export for potential direct use
export { reorganizeBookmarks };
