import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { queryAuditLog, getAuditLogStats, type AuditLogQuery } from '@lib/services/audit-log.js';
import type { LogLevel, LogCategory } from '@lib/services/activity-logger.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category') as LogCategory | null;
  const level = url.searchParams.get('level') as LogLevel | null;
  const scraperName = url.searchParams.get('scraper') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const startDate = url.searchParams.get('startDate') ? parseInt(url.searchParams.get('startDate')!, 10) : undefined;
  const endDate = url.searchParams.get('endDate') ? parseInt(url.searchParams.get('endDate')!, 10) : undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const query: AuditLogQuery = {
    category: category || undefined,
    level: level || undefined,
    scraperName,
    search,
    startDate,
    endDate,
    limit,
    offset,
  };

  const result = await queryAuditLog(query);
  const stats = await getAuditLogStats();

  return new Response(JSON.stringify({ ...result, stats }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
