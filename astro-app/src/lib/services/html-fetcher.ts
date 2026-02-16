/**
 * HTML fetcher service — fetches raw HTML from a target URL.
 * Extracted from scripts/capture-fixture.ts for reuse in the /extract/url handler.
 */

import { logActivity } from './activity-logger.js';

export interface FetchHtmlResult {
  success: boolean;
  html?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch the HTML content of a URL using realistic browser headers.
 * Returns a result object instead of throwing.
 */
export async function fetchHtml(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FetchHtmlResult> {
  logActivity({
    level: 'info',
    category: 'extraction',
    message: `Fetching HTML from URL: ${url}`,
    sourceUrl: url,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = `HTTP ${response.status} ${response.statusText}`;
      logActivity({
        level: 'warn',
        category: 'extraction',
        message: `Fetch failed: ${error}`,
        sourceUrl: url,
      });
      return { success: false, error };
    }

    const html = await response.text();

    logActivity({
      level: 'info',
      category: 'extraction',
      message: `Fetched ${html.length} bytes from ${url}`,
      sourceUrl: url,
    });

    return { success: true, html };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const error = isAbort
      ? `Request timed out after ${timeoutMs}ms`
      : err instanceof Error
        ? err.message
        : String(err);

    logActivity({
      level: 'warn',
      category: 'extraction',
      message: `Fetch error: ${error}`,
      sourceUrl: url,
    });

    return { success: false, error };
  } finally {
    clearTimeout(timer);
  }
}
