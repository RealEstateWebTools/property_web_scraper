import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { clearLogs } from '@lib/services/activity-logger.js';
import { clearCache } from '@lib/extractor/mapping-loader.js';
import { clearListingStore } from '@lib/services/listing-store.js';
import { resetRateLimiter } from '@lib/services/rate-limiter.js';

type AdminAction = 'clear_logs' | 'clear_mapping_cache' | 'clear_listing_store' | 'reset_rate_limiter';

const actions: Record<AdminAction, { execute: () => void; message: string }> = {
  clear_logs: {
    execute: clearLogs,
    message: 'Activity logs cleared',
  },
  clear_mapping_cache: {
    execute: clearCache,
    message: 'Scraper mapping cache cleared',
  },
  clear_listing_store: {
    execute: clearListingStore,
    message: 'Listing store cleared',
  },
  reset_rate_limiter: {
    execute: resetRateLimiter,
    message: 'Rate limiter reset',
  },
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
    const action = body.action as AdminAction;

    if (!action || !actions[action]) {
      return new Response(JSON.stringify({
        error: `Invalid action. Valid actions: ${Object.keys(actions).join(', ')}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    actions[action].execute();

    return new Response(JSON.stringify({
      success: true,
      message: actions[action].message,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
