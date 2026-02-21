import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { listWebhooks, registerWebhook, removeWebhook, type WebhookEvent } from '@lib/services/webhook-service.js';

const VALID_EVENTS: WebhookEvent[] = ['extraction.completed', 'extraction.failed'];

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const webhooks = await listWebhooks();

  return new Response(JSON.stringify({
    total: webhooks.length,
    webhooks: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
      hasSecret: !!w.secret,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { url, events, secret } = body;
      if (!url || typeof url !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing or invalid url' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!Array.isArray(events) || events.length === 0 || !events.every((e: string) => VALID_EVENTS.includes(e as WebhookEvent))) {
        return new Response(JSON.stringify({ error: `Invalid events. Valid: ${VALID_EVENTS.join(', ')}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const webhook = await registerWebhook(url, events as WebhookEvent[], secret || undefined);
      return new Response(JSON.stringify({ success: true, webhook: { id: webhook.id, url: webhook.url, events: webhook.events } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const { webhookId } = body;
      if (!webhookId) {
        return new Response(JSON.stringify({ error: 'Missing webhookId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const removed = await removeWebhook(webhookId);
      return new Response(JSON.stringify({ success: true, removed }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('limit reached') ? 409 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
