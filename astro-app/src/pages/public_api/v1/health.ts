import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';
import { successResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { getStorageStatus } from '@lib/firestore/client.js';

export const GET: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  // Run KV and Firestore probes in parallel
  const [kvCheck, firestoreCheck] = await Promise.all([
    probeKV(locals),
    Promise.resolve(probeFirestore()),
  ]);

  const allAvailable = kvCheck.available && firestoreCheck.connected;
  const status = allAvailable ? 'ok' : 'degraded';

  const response = successResponse({
    status,
    scrapers_loaded: allMappingNames().length,
    checks: {
      kv: kvCheck,
      firestore: firestoreCheck,
    },
  }, request);

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `GET health: ${status}`,
    method: 'GET',
    path: '/public_api/v1/health',
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return response;
};

async function probeKV(locals: App.Locals): Promise<{ available: boolean; latency_ms?: number; error?: string }> {
  try {
    const kv = resolveKV(locals);
    if (!kv) {
      return { available: false, error: 'no_binding' };
    }
    const t0 = Date.now();
    await kv.get('health-check', 'text');
    return { available: true, latency_ms: Date.now() - t0 };
  } catch (err) {
    return { available: false, error: (err as Error).message || String(err) };
  }
}

function probeFirestore(): { backend: string; connected: boolean; project_id: string | null } {
  const s = getStorageStatus();
  return { backend: s.backend, connected: s.connected, project_id: s.projectId };
}
