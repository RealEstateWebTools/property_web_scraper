/**
 * webhook-service.ts — Webhook registration and firing.
 *
 * Firestore-backed registry with HMAC-SHA256 signature support.
 * Events: extraction.completed, extraction.failed
 *
 * Firestore collection: {prefix}webhooks
 * Document ID: webhook.id (nanoid-style)
 */

import { logActivity } from './activity-logger.js';
import { recordDeadLetter } from './dead-letter.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';

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

/** Maximum number of webhook registrations to prevent unbounded growth. */
export const MAX_WEBHOOKS = 20;

const inMemoryStore = new Map<string, WebhookRegistration>();

function generateId(): string {
  return `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Firestore helpers ────────────────────────────────────────────

async function firestoreSaveWebhook(webhook: WebhookRegistration): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const col = db.collection(`${prefix}webhooks`);
  await col.doc(webhook.id).set(JSON.parse(JSON.stringify(webhook)));
}

async function firestoreDeleteWebhook(id: string): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  await db.collection(`${prefix}webhooks`).doc(id).delete();
}

async function firestoreListWebhooks(): Promise<WebhookRegistration[]> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const col = db.collection(`${prefix}webhooks`);
  const snapshot = await col.where('active', '==', true).get();
  return snapshot.docs.map(doc => doc.data() as WebhookRegistration);
}

async function firestoreGetWebhook(id: string): Promise<WebhookRegistration | null> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const doc = await db.collection(`${prefix}webhooks`).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as WebhookRegistration;
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
  await firestoreSaveWebhook(registration);

  return registration;
}

export async function removeWebhook(id: string): Promise<boolean> {
  const existed = inMemoryStore.delete(id);
  try {
    await firestoreDeleteWebhook(id);
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[WebhookService] Firestore delete failed: ' + ((err as Error).message || err) });
  }
  return existed;
}

export async function listWebhooks(): Promise<WebhookRegistration[]> {
  try {
    return await firestoreListWebhooks();
  } catch {
    // Firestore unavailable — fall back to in-memory
    return Array.from(inMemoryStore.values()).filter(w => w.active);
  }
}

export async function getWebhook(id: string): Promise<WebhookRegistration | null> {
  try {
    return await firestoreGetWebhook(id);
  } catch {
    return inMemoryStore.get(id) || null;
  }
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

export async function clearWebhookStore(): Promise<void> {
  inMemoryStore.clear();
  // Clear Firestore state (for test environments)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snap = await db.collection(`${prefix}webhooks`).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  } catch {
    // Firestore unavailable — in-memory already cleared above
  }
}

export { computeHmacSha256 };
