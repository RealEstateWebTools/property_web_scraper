/**
 * Resilient HTTP fetch with retry, backoff, User-Agent rotation,
 * and bot-block detection.
 *
 * Inspired by Fredy's multi-layered anti-bot defense strategy.
 */

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

const BLOCK_PATTERNS = /captcha|verify you are human|access denied|cloudflare|just a moment|blocked|rate limit/i;
const RETRYABLE_STATUS = new Set([429, 403, 503, 502]);

export interface ResilientFetchOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  userAgentPool?: string[];
}

export interface FetchResult {
  html: string;
  statusCode: number;
  blocked: boolean;
  retryCount: number;
  userAgent: string;
}

function randomUA(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlocked(html: string, statusCode: number): boolean {
  if (statusCode === 403 || statusCode === 429) return true;
  if (html.length < 2000 && BLOCK_PATTERNS.test(html)) return true;
  return false;
}

/**
 * Fetch a URL with automatic retry, exponential backoff with jitter,
 * rotating User-Agents, and bot-block detection.
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<FetchResult> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 500;
  const maxDelay = options.maxDelay ?? 5000;
  const timeout = options.timeout ?? 30000;
  const pool = options.userAgentPool ?? UA_POOL;

  let lastResult: FetchResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ua = randomUA(pool);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
      });

      const html = await response.text();
      const blocked = isBlocked(html, response.status);

      lastResult = {
        html,
        statusCode: response.status,
        blocked,
        retryCount: attempt,
        userAgent: ua,
      };

      // Success and not blocked — return immediately
      if (response.ok && !blocked) {
        return lastResult;
      }

      // Non-retryable status — return as-is
      if (!RETRYABLE_STATUS.has(response.status) && !blocked) {
        return lastResult;
      }
    } catch (err) {
      lastResult = {
        html: '',
        statusCode: 0,
        blocked: false,
        retryCount: attempt,
        userAgent: ua,
      };
    } finally {
      clearTimeout(timer);
    }

    // Exponential backoff with jitter before retry
    if (attempt < maxRetries) {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 1000;
      await sleep(delay + jitter);
    }
  }

  return lastResult!;
}
