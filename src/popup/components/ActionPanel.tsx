import { useState, useEffect, useRef } from 'preact/hooks';
import { HealthMetrics, SiftBookmark, DeadLinkCheckState } from '../../utils/types';
import { DuplicatesList } from './DuplicatesList';
import { DeadLinksList } from './DeadLinksList';

interface ActionPanelProps {
  metrics: HealthMetrics;
  onActionComplete: () => void;
  onStatusChange: (message: string) => void;
}

export function ActionPanel({ metrics, onActionComplete, onStatusChange }: ActionPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showDeadLinks, setShowDeadLinks] = useState(false);
  const [deadLinkCheckState, setDeadLinkCheckState] = useState<DeadLinkCheckState | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Check dead link status on mount and poll while running
  useEffect(() => {
    checkDeadLinkStatus();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Start/stop polling based on check state
  useEffect(() => {
    if (deadLinkCheckState?.status === 'running') {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = window.setInterval(checkDeadLinkStatus, 1000);
      }
      onStatusChange(`Checking links: ${deadLinkCheckState.checked}/${deadLinkCheckState.total} (${deadLinkCheckState.deadLinks.length} dead found)`);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (deadLinkCheckState?.status === 'completed' && deadLinkCheckState.deadLinks.length > 0) {
        onStatusChange(`Found ${deadLinkCheckState.deadLinks.length} dead links - click "View Results" to see them`);
      }
    }
  }, [deadLinkCheckState]);

  async function checkDeadLinkStatus() {
    try {
      const state: DeadLinkCheckState = await chrome.runtime.sendMessage({ type: 'GET_DEAD_LINK_CHECK_STATUS' });
      setDeadLinkCheckState(state);
    } catch (error) {
      console.error('Failed to get dead link check status:', error);
    }
  }

  const duplicateCount = metrics.duplicates.reduce(
    (sum, g) => sum + g.bookmarks.length - 1,
    0
  );

  async function handleAction(
    actionName: string,
    action: () => Promise<void>
  ) {
    setLoading(actionName);
    setStatus(null);
    onStatusChange(`${actionName}...`);
    try {
      await action();
      setStatus(`${actionName} completed successfully`);
      onStatusChange(`${actionName} completed`);
      onActionComplete();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMsg}`);
      onStatusChange(`Error: ${errorMsg}`);
    }
    setLoading(null);
  }

  async function removeDuplicates() {
    setShowDuplicates(false);
    await handleAction('Remove duplicates', async () => {
      onStatusChange(`Removing ${duplicateCount} duplicate bookmarks...`);
      const result = await chrome.runtime.sendMessage({
        type: 'REMOVE_DUPLICATES',
        groups: metrics.duplicates,
      });
      if (result.error) throw new Error(result.error);
      onStatusChange(`Removed ${result.removed} duplicate bookmarks`);
    });
  }

  async function deleteStale() {
    await handleAction('Delete stale bookmarks', async () => {
      onStatusChange(`Deleting ${metrics.staleBookmarks.length} stale bookmarks...`);
      const result = await chrome.runtime.sendMessage({
        type: 'DELETE_STALE',
        bookmarks: metrics.staleBookmarks,
      });
      if (result.error) throw new Error(result.error);
      onStatusChange(`Deleted ${result.deleted} stale bookmarks`);
    });
  }

  async function sortBookmarks() {
    await handleAction('Sort bookmarks', async () => {
      onStatusChange('Sorting all folders alphabetically...');
      const result = await chrome.runtime.sendMessage({
        type: 'SORT_BOOKMARKS',
      });
      if (result.error) throw new Error(result.error);
      onStatusChange('All folders sorted alphabetically');
    });
  }

  async function startDeadLinkCheck() {
    try {
      onStatusChange('Starting dead link check...');
      const result = await chrome.runtime.sendMessage({ type: 'START_DEAD_LINK_CHECK' });
      if (!result.started) {
        setStatus(result.message || 'Failed to start check');
        onStatusChange(result.message || 'Failed to start check');
      } else {
        // Show skipped count if any links were skipped due to caching
        if (result.skipped && result.skipped > 0) {
          onStatusChange(`Starting check... (${result.skipped} links skipped - recently checked)`);
        }
        // Immediately check status to start polling
        await checkDeadLinkStatus();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMsg}`);
      onStatusChange(`Error: ${errorMsg}`);
    }
  }

  async function cancelDeadLinkCheck() {
    try {
      await chrome.runtime.sendMessage({ type: 'CANCEL_DEAD_LINK_CHECK' });
      await checkDeadLinkStatus();
      onStatusChange('Dead link check cancelled');
    } catch (error) {
      console.error('Failed to cancel check:', error);
    }
  }

  async function clearDeadLinkResults() {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_DEAD_LINK_RESULTS' });
      await checkDeadLinkStatus();
      onStatusChange('Ready');
    } catch (error) {
      console.error('Failed to clear results:', error);
    }
  }

  async function categorizeWithAI() {
    await handleAction('AI categorization', async () => {
      onStatusChange('Fetching bookmarks for AI analysis...');
      const bookmarks = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' });
      onStatusChange(`Sending ${bookmarks.length} bookmarks to Claude for categorization...`);
      const suggestions = await chrome.runtime.sendMessage({
        type: 'CATEGORIZE_BOOKMARKS',
        bookmarks,
      });
      if (suggestions.error) throw new Error(suggestions.error);
      onStatusChange(`AI suggested ${suggestions.length} categories`);
    });
  }

  async function createSiftFolder() {
    const name = prompt('Enter folder name (leave blank for today\'s date):');
    await handleAction('Create Sift folder', async () => {
      onStatusChange('Creating Sift folder...');
      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_SIFT_FOLDER',
        name: name || undefined,
      });
      if (result.error) throw new Error(result.error);
      onStatusChange(`Created folder: Sift/${result.title}`);
    });
  }

  async function deleteDeadLinks(bookmarksToDelete: SiftBookmark[]) {
    setShowDeadLinks(false);
    await handleAction('Delete dead links', async () => {
      onStatusChange(`Deleting ${bookmarksToDelete.length} dead links...`);
      const result = await chrome.runtime.sendMessage({
        type: 'DELETE_DEAD_LINKS',
        bookmarks: bookmarksToDelete,
      });
      if (result.error) throw new Error(result.error);
      // Clear the background check results after deletion
      await chrome.runtime.sendMessage({ type: 'CLEAR_DEAD_LINK_RESULTS' });
      await checkDeadLinkStatus();
      onStatusChange(`Deleted ${result.deleted} dead links`);
    });
  }

  if (showDeadLinks && deadLinkCheckState?.deadLinks && deadLinkCheckState.deadLinks.length > 0) {
    return (
      <DeadLinksList
        bookmarks={deadLinkCheckState.deadLinks}
        onClose={() => setShowDeadLinks(false)}
        onDelete={deleteDeadLinks}
        onStatusChange={onStatusChange}
      />
    );
  }

  if (showDuplicates) {
    return (
      <DuplicatesList
        groups={metrics.duplicates}
        onClose={() => setShowDuplicates(false)}
        onRemove={removeDuplicates}
        onStatusChange={onStatusChange}
      />
    );
  }

  const isCheckRunning = deadLinkCheckState?.status === 'running';
  const hasResults = deadLinkCheckState?.status === 'completed' && deadLinkCheckState.deadLinks.length > 0;
  const progressPercent = deadLinkCheckState && deadLinkCheckState.total > 0
    ? Math.round((deadLinkCheckState.checked / deadLinkCheckState.total) * 100)
    : 0;

  return (
    <div>
      {status && (
        <div
          class={`metric-card ${status.startsWith('Error') ? 'danger' : ''}`}
          style={{ marginBottom: '16px' }}
        >
          <div class="metric-label">{status}</div>
        </div>
      )}

      {isCheckRunning && (
        <div class="progress-container">
          <div class="progress-header">
            <span>Checking links (runs in background)...</span>
            <span>{deadLinkCheckState.checked} / {deadLinkCheckState.total}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div class="progress-details">
            <span>{progressPercent}% complete</span>
            <span>{deadLinkCheckState.deadLinks.length} dead links found</span>
          </div>
          <button
            class="btn btn-secondary"
            onClick={cancelDeadLinkCheck}
            style={{ marginTop: '12px', width: '100%' }}
          >
            Cancel Check
          </button>
        </div>
      )}

      {hasResults && (
        <div class="progress-container">
          <div class="progress-header">
            <span>Dead Link Check Complete</span>
          </div>
          <div class="progress-details" style={{ marginTop: '0' }}>
            <span>Found {deadLinkCheckState.deadLinks.length} dead link{deadLinkCheckState.deadLinks.length === 1 ? '' : 's'}</span>
          </div>
          <div class="action-row" style={{ marginTop: '12px' }}>
            <button
              class="btn btn-primary"
              onClick={() => setShowDeadLinks(true)}
            >
              View Results
            </button>
            <button
              class="btn btn-secondary"
              onClick={clearDeadLinkResults}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div class="section-header">
        <span class="section-title">Cleanup Actions</span>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          onClick={sortBookmarks}
          disabled={loading !== null}
        >
          {loading === 'Sort bookmarks' ? 'Sorting...' : 'Sort Folders & Bookmarks'}
        </button>

        <div class="action-row">
          <button
            class="btn btn-primary"
            onClick={() => setShowDuplicates(true)}
            disabled={loading !== null || duplicateCount === 0}
          >
            View Duplicates ({duplicateCount})
          </button>
          <button
            class="btn btn-primary"
            onClick={removeDuplicates}
            disabled={loading !== null || duplicateCount === 0}
          >
            {loading === 'Remove duplicates' ? 'Removing...' : 'Remove Duplicates'}
          </button>
        </div>

        <button
          class="btn btn-primary"
          onClick={deleteStale}
          disabled={loading !== null || metrics.staleBookmarks.length === 0}
        >
          {loading === 'Delete stale bookmarks'
            ? 'Deleting...'
            : `Delete ${metrics.staleBookmarks.length} Stale Bookmarks`}
        </button>

        <button
          class="btn btn-primary"
          onClick={startDeadLinkCheck}
          disabled={loading !== null || isCheckRunning}
        >
          {isCheckRunning ? `Checking... (${progressPercent}%)` : 'Check Dead Links'}
        </button>
      </div>

      <div class="section-header" style={{ marginTop: '24px' }}>
        <span class="section-title">AI Features</span>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          onClick={categorizeWithAI}
          disabled={loading !== null}
        >
          {loading === 'AI categorization' ? 'Analyzing...' : 'Suggest Categories (AI)'}
        </button>

        <button
          class="btn btn-primary"
          onClick={createSiftFolder}
          disabled={loading !== null}
        >
          {loading === 'Create Sift folder' ? 'Creating...' : 'Create Sift Folder'}
        </button>
      </div>

      <style>{`
        .action-row {
          display: flex;
          gap: 8px;
        }

        .action-row .btn {
          flex: 1;
        }

        .progress-container {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .progress-bar {
          height: 12px;
          background: #e9ecef;
          border-radius: 6px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #4a90d9;
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .progress-details {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 12px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}
