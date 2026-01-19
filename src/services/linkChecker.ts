import { LinkCheckResult, SiftBookmark } from '../utils/types';

const TIMEOUT_MS = 10000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

async function checkLink(url: string): Promise<LinkCheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors', // Allows checking cross-origin URLs
    });

    clearTimeout(timeoutId);

    // With no-cors, we can't read status, but if we get here it's likely alive
    // For same-origin or CORS-enabled URLs, we can check status
    if (response.type === 'opaque') {
      // no-cors response - assume alive if no error
      return { url, status: 'alive' };
    }

    if (response.ok || response.status === 301 || response.status === 302) {
      return { url, status: 'alive', statusCode: response.status };
    }

    if (response.status === 404 || response.status === 410) {
      return { url, status: 'dead', statusCode: response.status };
    }

    return { url, status: 'alive', statusCode: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { url, status: 'timeout' };
    }
    return { url, status: 'error' };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkLinks(
  urls: string[],
  onProgress?: (checked: number, total: number) => void
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(checkLink));
    results.push(...batchResults);

    if (onProgress) {
      onProgress(results.length, urls.length);
    }

    // Rate limiting between batches
    if (i + BATCH_SIZE < urls.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

export async function findDeadLinks(bookmarks: SiftBookmark[]): Promise<SiftBookmark[]> {
  const urls = bookmarks.map((b) => b.url);
  const results = await checkLinks(urls);

  const deadUrls = new Set(
    results.filter((r) => r.status === 'dead').map((r) => r.url)
  );

  return bookmarks.filter((b) => deadUrls.has(b.url));
}
