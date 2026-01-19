import { HealthMetrics } from '../../utils/types';

interface DashboardProps {
  metrics: HealthMetrics;
  onRefresh?: () => void;
}

function getScoreClass(score: number): string {
  if (score >= 70) return 'good';
  if (score >= 40) return 'medium';
  return 'poor';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Needs Work';
  return 'Poor';
}

function getScoreExplanation(metrics: HealthMetrics, duplicateCount: number): string {
  const issues: string[] = [];

  if (duplicateCount > 0) {
    issues.push(`${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''}`);
  }
  if (metrics.deadLinks.length > 0) {
    issues.push(`${metrics.deadLinks.length} dead link${metrics.deadLinks.length > 1 ? 's' : ''}`);
  }
  if (metrics.staleBookmarks.length > 0) {
    issues.push(`${metrics.staleBookmarks.length} stale`);
  }
  if (metrics.uncategorizedCount > 10) {
    issues.push(`${metrics.uncategorizedCount} uncategorized`);
  }

  if (issues.length === 0) {
    return 'Your bookmarks are well organized!';
  }

  return `Score affected by: ${issues.join(', ')}`;
}

export function Dashboard({ metrics }: DashboardProps) {
  const duplicateCount = metrics.duplicates.reduce(
    (sum, g) => sum + g.bookmarks.length - 1,
    0
  );

  return (
    <div>
      <div class="health-score">
        <div class={`score-circle ${getScoreClass(metrics.healthScore)}`}>
          {metrics.healthScore}
        </div>
        <span class="score-label">{getScoreLabel(metrics.healthScore)}</span>
        <p class="score-explanation">{getScoreExplanation(metrics, duplicateCount)}</p>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{metrics.totalBookmarks}</div>
          <div class="metric-label">Total Bookmarks</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{metrics.totalFolders}</div>
          <div class="metric-label">Folders</div>
        </div>
        <div class={`metric-card ${duplicateCount > 0 ? 'warning' : ''}`}>
          <div class="metric-value">{duplicateCount}</div>
          <div class="metric-label">Duplicates</div>
        </div>
        <div class={`metric-card ${metrics.deadLinks.length > 0 ? 'danger' : ''}`}>
          <div class="metric-value">{metrics.deadLinks.length}</div>
          <div class="metric-label">Dead Links</div>
        </div>
        <div class={`metric-card ${metrics.staleBookmarks.length > 0 ? 'warning' : ''}`}>
          <div class="metric-value">{metrics.staleBookmarks.length}</div>
          <div class="metric-label">Stale (180+ days)</div>
        </div>
        <div class={`metric-card ${metrics.uncategorizedCount > 10 ? 'warning' : ''}`}>
          <div class="metric-value">{metrics.uncategorizedCount}</div>
          <div class="metric-label">Uncategorized</div>
        </div>
      </div>
    </div>
  );
}
