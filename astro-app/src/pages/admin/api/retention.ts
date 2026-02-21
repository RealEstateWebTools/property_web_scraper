import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getRetentionConfig, updateRetentionPolicy } from '@lib/services/retention-config.js';
import { runCleanup, getLastCleanupResult } from '@lib/services/retention-cleanup.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = await getRetentionConfig();
  const lastCleanup = getLastCleanupResult();

  return new Response(JSON.stringify({ config, lastCleanup }), {
    status: 200,
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const action = body.action as string;

  if (action === 'cleanup') {
    const dryRun = body.dryRun === true;
    const result = await runCleanup({ dryRun });
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (action === 'update_policy') {
    const collectionName = body.collectionName as string;
    const ttlDays = body.ttlDays as number;

    if (!collectionName || !ttlDays) {
      return new Response(JSON.stringify({ error: 'Missing collectionName or ttlDays' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const config = await updateRetentionPolicy(collectionName, ttlDays);
      return new Response(JSON.stringify({ config }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
