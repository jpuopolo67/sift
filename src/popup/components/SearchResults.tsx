import { SiftBookmark } from '../../utils/types';

interface SearchResultsProps {
  query: string;
  results: SiftBookmark[];
  onSearch: (query: string) => void;
}

function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function SearchResults({ query, results, onSearch }: SearchResultsProps) {
  return (
    <div>
      <div class="search-container">
        <input
          type="text"
          class="search-input"
          placeholder="Search bookmarks..."
          value={query}
          onInput={(e) => onSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      {query && results.length === 0 && (
        <div class="empty-state">
          <p>No bookmarks found for "{query}"</p>
        </div>
      )}

      {results.length > 0 && (
        <div class="bookmark-list">
          {results.map((bookmark) => (
            <div class="bookmark-item" key={bookmark.id}>
              <img
                class="bookmark-favicon"
                src={getFaviconUrl(bookmark.url)}
                alt=""
              />
              <div class="bookmark-info">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <div class="bookmark-title">{bookmark.title || 'Untitled'}</div>
                  <div class="bookmark-url">{bookmark.url}</div>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {!query && (
        <div class="empty-state">
          <p>Enter a keyword to search your bookmarks</p>
        </div>
      )}
    </div>
  );
}
