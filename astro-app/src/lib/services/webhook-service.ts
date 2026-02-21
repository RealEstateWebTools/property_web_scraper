/**
 * webhook-service.ts — Webhook registration and firing.
 *
 * KV-backed registry with HMAC-SHA256 signature support.
 * Events: extraction.completed, extraction.failed
 */

import type { KVNamespace } from './kv-types.js';
import { logActivity } from './activity-logger.js';
import { recordDeadLetter } from './dead-letter.js';

// ─── Types ───────────────────────────────────────────────────────

export type WebhookEvent = 'extraction.completed' | 'extraction.failed';

export interface WebhookRegistration {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  createdAt: string;
  active: boolean;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  webhookId: string;
  url: string;
  statusCode: number | null;
  success: boolean;
  error?: string;
  durationMs: number;
}

// ─── Storage ─────────────────────────────────────────────────────

/** Maximum number of webhook registrations to prevent unbounded KV growth. */
export const MAX_WEBHOOKS = 20;

let kv: KVNamespace | null = null;
const inMemoryStore = new Map<string, WebhookRegistration>();

const KV_PREFIX = 'webhook:';
const KV_INDEX = 'webhook-index';
const KV_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/**
 * Bind the KV namespace for persistent storage.
 * Call once per request from Astro middleware.
 */
export function initWebhookKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

function generateId(): string {
  return `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── HMAC Signing ────────────────────────────────────────────────

async function computeHmacSha256(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  // Use Web Crypto API (works in Cloudflare Workers + Node 18+)
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Registry Operations ────────────────────────────────────────

export async function registerWebhook(
  url: string,
  events: WebhookEvent[],
  secret?: string,
): Promise<WebhookRegistration> {
  // Enforce registration limit
  const existing = await listWebhooks();
  if (existing.length >= MAX_WEBHOOKS) {
    throw new Error(`Webhook limit reached (${MAX_WEBHOOKS}/${MAX_WEBHOOKS})`);
  }

  const registration: WebhookRegistration = {
    id: generateId(),
    url,
    events,
    secret,
    createdAt: new Date().toISOString(),
    active: true,
  };

  inMemoryStore.set(registration.id, registration);

  if (kv) {
    // Store individual webhook
    await kv.put(`${KV_PREFIX}${registration.id}`, JSON.stringify(registration), { expirationTtl: KV_TTL_SECONDS });
    // Update index
    const index = await getIndex();
    index.push(registration.id);
    await kv.put(KV_INDEX, JSON.stringify(index), { expirationTtl: KV_TTL_SECONDS });
  }

  return registration;
}

export async function removeWebhook(id: string): Promise<boolean> {
  const existed = inMemoryStore.delete(id);

  if (kv) {
    await kv.delete(`${KV_PREFIX}${id}`);
    const index = await getIndex();
    const filtered = index.filter((wid: string) => wid !== id);
    await kv.put(KV_INDEX, JSON.stringify(filtered));
  }

  return existed;
}

export async function listWebhooks(): Promise<WebhookRegistration[]> {
  if (kv) {
    const index = await getIndex();
    const webhooks: WebhookRegistration[] = [];
    for (const id of index) {
      const data = await kv.get(`${KV_PREFIX}${id}`, 'json');
      if (data) webhooks.push(data as WebhookRegistration);
    }
    return webhooks;
  }
  return Array.from(inMemoryStore.values());
}

export async function getWebhook(id: string): Promise<WebhookRegistration | null> {
  if (kv) {
    return await kv.get(`${KV_PREFIX}${id}`, 'json') as WebhookRegistration | null;
  }
  return inMemoryStore.get(id) || null;
}

async function getIndex(): Promise<string[]> {
  if (kv) {
    const data = await kv.get(KV_INDEX, 'json');
    return (data as string[]) || [];
  }
  return Array.from(inMemoryStore.keys());
}

// ─── Retry Configuration ─────────────────────────────────────────

const MAX_RETRIES = 2; // 3 total attempts
const BACKOFF_MS = [500, 1000];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exported for testing
export { MAX_RETRIES, BACKOFF_MS };

// ─── Webhook Delivery ────────────────────────────────────────────

/**
 * Fire webhooks for a specific event.
 * Each webhook delivery is retried up to MAX_RETRIES times with exponential
 * backoff on transient failures (network errors, 429, 5xx).
 * After all retries are exhausted, a dead-letter entry is recorded.
 */
export async function fireWebhooks(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<WebhookDeliveryResult[]> {
  const webhooks = await listWebhooks();
  const matching = webhooks.filter(w => w.active && w.events.includes(event));

  if (matching.length === 0) return [];

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadJson = JSON.stringify(payload);

  const results = await Promise.allSettled(
    matching.map(async (webhook): Promise<WebhookDeliveryResult> => {
      const startTime = Date.now();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'PropertyWebScraper-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Id': webhook.id,
      };

      if (webhook.secret) {
        const signature = await computeHmacSha256(payloadJson, webhook.secret);
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      let lastError: string | undefined;
      let lastStatusCode: number | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          logActivity({
            level: 'warn',
            category: 'system',
            message: `[Webhook] Retry ${attempt}/${MAX_RETRIES} for ${webhook.url} (previous: ${lastStatusCode ?? lastError})`,
          });
          await sleep(BACKOFF_MS[attempt - 1]);
        }

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: payloadJson,
            signal: AbortSignal.timeout(10000),
          });

          lastStatusCode = response.status;

          if (response.status >= 200 && response.status < 300) {
            return {
              webhookId: webhook.id,
              url: webhook.url,
              statusCode: response.status,
              success: true,
              durationMs: Date.now() - startTime,
            };
          }

          // Non-retryable client error (4xx except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return {
              webhookId: webhook.id,
              url: webhook.url,
              statusCode: response.status,
              success: false,
              error: `HTTP ${response.status}`,
              durationMs: Date.now() - startTime,
            };
          }

          lastError = `HTTP ${response.status}`;
        } catch (err: any) {
          lastStatusCode = null;
          lastError = err.message || 'Unknown error';
        }
      }

      // All retries exhausted — record dead-letter
      recordDeadLetter({
        source: 'webhook',
        operation: `POST ${webhook.url}`,
        error: lastError || 'Unknown error',
        context: { webhookId: webhook.id, event, statusCode: lastStatusCode },
        attempts: MAX_RETRIES + 1,
      }).catch(() => {}); // DLQ write itself is best-effort

      return {
        webhookId: webhook.id,
        url: webhook.url,
        statusCode: lastStatusCode,
        success: false,
        error: lastError,
        durationMs: Date.now() - startTime,
      };
    }),
  );

  return results.map(r => r.status === 'fulfilled' ? r.value : {
    webhookId: 'unknown',
    url: 'unknown',
    statusCode: null,
    success: false,
    error: 'Promise rejected',
    durationMs: 0,
  });
}

// ─── Test Helpers ────────────────────────────────────────────────

export function clearWebhookStore(): void {
  inMemoryStore.clear();
}

export { computeHmacSha256 };
