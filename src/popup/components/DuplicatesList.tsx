import { useState, useEffect } from 'preact/hooks';
import { DuplicateGroup } from '../../utils/types';

interface DuplicatesListProps {
  groups: DuplicateGroup[];
  onClose: () => void;
  onRemove: () => void;
  onStatusChange: (message: string) => void;
}

export function DuplicatesList({ groups, onClose, onRemove, onStatusChange }: DuplicatesListProps) {
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaths();
  }, [groups]);

  async function loadPaths() {
    setLoading(true);
    const allBookmarkIds = groups.flatMap((g) => g.bookmarks.map((b) => b.id));
    onStatusChange(`Loading paths for ${allBookmarkIds.length} bookmarks...`);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GET_BOOKMARK_PATHS',
        bookmarkIds: allBookmarkIds,
      });
      if (result && !result.error) {
        setPaths(result);
        onStatusChange(`Showing ${groups.length} duplicate groups`);
      }
    } catch (error) {
      console.error('Failed to load paths:', error);
      onStatusChange('Failed to load bookmark paths');
    }
    setLoading(false);
  }

  const totalDuplicates = groups.reduce(
    (sum, g) => sum + g.bookmarks.length - 1,
    0
  );

  if (loading) {
    return (
      <div class="duplicates-panel">
        <div class="duplicates-header">
          <h3>Duplicate Bookmarks</h3>
          <button class="close-btn" onClick={onClose}>×</button>
        </div>
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading duplicates...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="duplicates-panel">
      <div class="duplicates-header">
        <h3>Duplicate Bookmarks ({totalDuplicates})</h3>
        <button class="close-btn" onClick={onClose}>×</button>
      </div>

      <div class="duplicates-content">
        {groups.map((group, groupIndex) => (
          <div class="duplicate-group" key={groupIndex}>
            <div class="group-header">
              <span class="group-count">{group.bookmarks.length} copies</span>
              <span class="group-url" title={group.normalizedUrl}>
                {truncateUrl(group.normalizedUrl)}
              </span>
            </div>
            <div class="group-bookmarks">
              {group.bookmarks.map((bookmark) => (
                <div class="duplicate-item" key={bookmark.id}>
                  <div class="duplicate-title">{bookmark.title || 'Untitled'}</div>
                  <div class="duplicate-path">{paths[bookmark.id] || 'Loading...'}</div>
                  <div class="duplicate-url">
                    <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                      {bookmark.url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div class="duplicates-footer">
        <button class="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button class="btn btn-danger" onClick={onRemove}>
          Remove {totalDuplicates} Duplicates
        </button>
      </div>

      <style>{`
        .duplicates-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #f5f5f5;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }

        .duplicates-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border-bottom: 1px solid #dee2e6;
        }

        .duplicates-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #343a40;
        }

        .duplicates-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .duplicate-group {
          background: white;
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .group-header {
          padding: 12px;
          background: #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .group-count {
          font-weight: 600;
          color: #dc3545;
          white-space: nowrap;
        }

        .group-url {
          font-size: 12px;
          color: #6c757d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .group-bookmarks {
          padding: 8px;
        }

        .duplicate-item {
          padding: 10px;
          border-bottom: 1px solid #e9ecef;
        }

        .duplicate-item:last-child {
          border-bottom: none;
        }

        .duplicate-title {
          font-weight: 500;
          color: #343a40;
          margin-bottom: 4px;
        }

        .duplicate-path {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .duplicate-url {
          font-size: 12px;
        }

        .duplicate-url a {
          color: #4a90d9;
          text-decoration: none;
          word-break: break-all;
        }

        .duplicate-url a:hover {
          text-decoration: underline;
        }

        .duplicates-footer {
          padding: 16px;
          background: white;
          border-top: 1px solid #dee2e6;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-danger {
          background: #dc3545;
        }

        .btn-danger:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  );
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}
