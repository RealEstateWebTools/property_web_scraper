import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { queryLogs, getLogStats, type LogLevel, type LogCategory } from '@lib/services/activity-logger.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const level = url.searchParams.get('level') as LogLevel | null;
  const category = url.searchParams.get('category') as LogCategory | null;
  const search = url.searchParams.get('search') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const result = queryLogs({
    level: level || undefined,
    category: category || undefined,
    search,
    limit,
    offset,
  });

  const stats = getLogStats();

  return new Response(JSON.stringify({ ...result, stats }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
