/**
 * webhook-service.ts — Webhook registration and firing.
 *
 * KV-backed registry with HMAC-SHA256 signature support.
 * Events: extraction.completed, extraction.failed
 */

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

let kv: any = null;
const inMemoryStore = new Map<string, WebhookRegistration>();

const KV_PREFIX = 'webhook:';
const KV_INDEX = 'webhook-index';

/**
 * Bind the KV namespace for persistent storage.
 * Call once per request from Astro middleware.
 */
export function initWebhookKV(kvNamespace: any): void {
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
    await kv.put(`${KV_PREFIX}${registration.id}`, JSON.stringify(registration));
    // Update index
    const index = await getIndex();
    index.push(registration.id);
    await kv.put(KV_INDEX, JSON.stringify(index));
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

// ─── Webhook Delivery ────────────────────────────────────────────

/**
 * Fire webhooks for a specific event.
 * Returns delivery results for each matching webhook.
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
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'PropertyWebScraper-Webhook/1.0',
          'X-Webhook-Event': event,
          'X-Webhook-Id': webhook.id,
        };

        // HMAC signature if secret is configured
        if (webhook.secret) {
          const signature = await computeHmacSha256(payloadJson, webhook.secret);
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: payloadJson,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        return {
          webhookId: webhook.id,
          url: webhook.url,
          statusCode: response.status,
          success: response.status >= 200 && response.status < 300,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        return {
          webhookId: webhook.id,
          url: webhook.url,
          statusCode: null,
          success: false,
          error: err.message || 'Unknown error',
          durationMs: Date.now() - startTime,
        };
      }
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
