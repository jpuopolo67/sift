import { useState, useEffect } from 'preact/hooks';
import { HealthMetrics, SiftBookmark } from '../utils/types';
import { Dashboard } from './components/Dashboard';
import { SearchResults } from './components/SearchResults';
import { ActionPanel } from './components/ActionPanel';

type Tab = 'dashboard' | 'search' | 'actions';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SiftBookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Separate status messages for each tab
  const [dashboardStatus, setDashboardStatus] = useState('Ready');
  const [actionsStatus, setActionsStatus] = useState('Ready');
  const [searchStatus, setSearchStatus] = useState('Enter a search term');

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setLoading(true);
    setDashboardStatus('Loading bookmarks...');
    try {
      setDashboardStatus('Analyzing bookmark health...');
      const result = await chrome.runtime.sendMessage({ type: 'GET_HEALTH_METRICS' });
      if (result && !result.error) {
        setMetrics(result);
        const duplicateCount = result.duplicates.reduce(
          (sum: number, g: { bookmarks: unknown[] }) => sum + g.bookmarks.length - 1,
          0
        );
        setDashboardStatus(
          `Found ${result.totalBookmarks} bookmarks, ${duplicateCount} duplicates, ${result.staleBookmarks.length} stale`
        );
        setActionsStatus('Select an action to clean up your bookmarks');
      } else if (result?.error) {
        setDashboardStatus(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      setDashboardStatus('Failed to load bookmarks');
    }
    setLoading(false);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchStatus('Enter a search term');
      return;
    }
    setSearchStatus(`Searching for "${query}"...`);
    try {
      const results = await chrome.runtime.sendMessage({
        type: 'SEARCH_BOOKMARKS',
        query,
      });
      setSearchResults(results || []);
      setSearchStatus(`Found ${results?.length || 0} bookmarks matching "${query}"`);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchStatus('Search failed');
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  // Get the status message for the current tab
  function getCurrentStatus(): string {
    switch (activeTab) {
      case 'dashboard':
        return dashboardStatus;
      case 'actions':
        return actionsStatus;
      case 'search':
        return searchStatus;
      default:
        return 'Ready';
    }
  }

  return (
    <div class="app">
      <header class="header">
        <h1>Sift</h1>
        <div class="header-actions">
          <button class="icon-btn" onClick={loadMetrics} title="Refresh">
            ↻
          </button>
          <button class="icon-btn" onClick={openOptions} title="Settings">
            ⚙
          </button>
        </div>
      </header>

      <nav class="tabs">
        <button
          class={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Health
        </button>
        <button
          class={`tab ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Actions
        </button>
        <button
          class={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </nav>

      <main class="content">
        {loading ? (
          <div class="loading">
            <div class="spinner"></div>
            <span>Analyzing bookmarks...</span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && metrics && (
              <Dashboard metrics={metrics} onRefresh={loadMetrics} />
            )}
            {activeTab === 'search' && (
              <SearchResults
                query={searchQuery}
                results={searchResults}
                onSearch={handleSearch}
              />
            )}
            {activeTab === 'actions' && metrics && (
              <ActionPanel
                metrics={metrics}
                onActionComplete={loadMetrics}
                onStatusChange={setActionsStatus}
              />
            )}
          </>
        )}
      </main>

      <footer class="status-bar">
        <span class="status-message">{getCurrentStatus()}</span>
      </footer>
    </div>
  );
}
