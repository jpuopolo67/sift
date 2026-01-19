import { useState, useEffect } from 'preact/hooks';
import { SiftBookmark } from '../../utils/types';

interface DeadLinksListProps {
  bookmarks: SiftBookmark[];
  onClose: () => void;
  onDelete: (bookmarks: SiftBookmark[]) => void;
  onStatusChange: (message: string) => void;
}

export function DeadLinksList({ bookmarks, onClose, onDelete, onStatusChange }: DeadLinksListProps) {
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(bookmarks.map(b => b.id)));

  useEffect(() => {
    loadPaths();
  }, [bookmarks]);

  async function loadPaths() {
    setLoading(true);
    const bookmarkIds = bookmarks.map((b) => b.id);
    onStatusChange(`Loading paths for ${bookmarkIds.length} dead links...`);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GET_BOOKMARK_PATHS',
        bookmarkIds,
      });
      if (result && !result.error) {
        setPaths(result);
        onStatusChange(`Found ${bookmarks.length} dead links`);
      }
    } catch (error) {
      console.error('Failed to load paths:', error);
      onStatusChange('Failed to load bookmark paths');
    }
    setLoading(false);
  }

  function toggleSelection(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function selectAll() {
    setSelectedIds(new Set(bookmarks.map(b => b.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function handleDelete() {
    const toDelete = bookmarks.filter(b => selectedIds.has(b.id));
    onDelete(toDelete);
  }

  if (loading) {
    return (
      <div class="dead-links-panel">
        <div class="dead-links-header">
          <h3>Dead Links</h3>
          <button class="close-btn" onClick={onClose}>×</button>
        </div>
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading dead links...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="dead-links-panel">
      <div class="dead-links-header">
        <h3>Dead Links ({bookmarks.length})</h3>
        <button class="close-btn" onClick={onClose}>×</button>
      </div>

      <div class="dead-links-toolbar">
        <span>{selectedIds.size} selected</span>
        <div class="toolbar-actions">
          <button class="link-btn" onClick={selectAll}>Select All</button>
          <button class="link-btn" onClick={selectNone}>Select None</button>
        </div>
      </div>

      <div class="dead-links-content">
        {bookmarks.map((bookmark) => (
          <div
            class={`dead-link-item ${selectedIds.has(bookmark.id) ? 'selected' : ''}`}
            key={bookmark.id}
            onClick={() => toggleSelection(bookmark.id)}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(bookmark.id)}
              onChange={() => toggleSelection(bookmark.id)}
            />
            <div class="dead-link-info">
              <div class="dead-link-title">{bookmark.title || 'Untitled'}</div>
              <div class="dead-link-path">{paths[bookmark.id] || 'Loading...'}</div>
              <div class="dead-link-url">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {bookmark.url}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div class="dead-links-footer">
        <button class="btn btn-primary" onClick={onClose}>
          Keep All
        </button>
        <button
          class="btn btn-danger"
          onClick={handleDelete}
          disabled={selectedIds.size === 0}
        >
          Delete {selectedIds.size} Dead Links
        </button>
      </div>

      <style>{`
        .dead-links-panel {
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

        .dead-links-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border-bottom: 1px solid #dee2e6;
        }

        .dead-links-header h3 {
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

        .dead-links-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #dee2e6;
          font-size: 13px;
        }

        .toolbar-actions {
          display: flex;
          gap: 12px;
        }

        .link-btn {
          background: none;
          border: none;
          color: #4a90d9;
          cursor: pointer;
          font-size: 13px;
          padding: 0;
        }

        .link-btn:hover {
          text-decoration: underline;
        }

        .dead-links-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .dead-link-item {
          background: white;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          display: flex;
          gap: 12px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: border-color 0.2s;
        }

        .dead-link-item:hover {
          border-color: #dee2e6;
        }

        .dead-link-item.selected {
          border-color: #4a90d9;
          background: #f0f7ff;
        }

        .dead-link-item input[type="checkbox"] {
          margin-top: 2px;
          cursor: pointer;
        }

        .dead-link-info {
          flex: 1;
          min-width: 0;
        }

        .dead-link-title {
          font-weight: 500;
          color: #343a40;
          margin-bottom: 4px;
        }

        .dead-link-path {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .dead-link-url {
          font-size: 12px;
        }

        .dead-link-url a {
          color: #dc3545;
          text-decoration: none;
          word-break: break-all;
        }

        .dead-link-url a:hover {
          text-decoration: underline;
        }

        .dead-links-footer {
          padding: 16px;
          background: white;
          border-top: 1px solid #dee2e6;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .btn-danger:disabled {
          background: #e9ecef;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}
