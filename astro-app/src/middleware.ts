import type { MiddlewareHandler } from 'astro';
import { validateEnv } from '@lib/services/env-validator.js';
import { corsPreflightResponse, buildCorsHeaders } from '@lib/services/api-response.js';
import { initAllKV } from '@lib/services/kv-init.js';
import { maybeTriggerCleanup } from '@lib/services/retention-cleanup.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const onRequest: MiddlewareHandler = async (context, next) => {
  validateEnv();
  initAllKV(context.locals);

  const startTime = Date.now();
  const { method } = context.request;
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('origin');

  // Firebase email action links point to /__/auth/action. Astro's file router
  // ignores _-prefixed paths, so we redirect here — preserving all query params.
  if (url.pathname === '/__/auth/action') {
    const dest = new URL(url);
    dest.pathname = '/auth/action';
    return Response.redirect(dest.toString(), 302);
  }

  console.log(`[Middleware] ${method} ${url.pathname} (origin: ${origin || 'none'})`);

  // Handle CORS preflight for API routes
  if (method === 'OPTIONS' && (url.pathname.startsWith('/public_api/') || url.pathname.startsWith('/ext/'))) {
    const preflightRes = corsPreflightResponse(context.request);
    console.log(`[Middleware] CORS preflight → ${preflightRes.status}`, Object.fromEntries(preflightRes.headers.entries()));
    return preflightRes;
  }

  const response = await next();

  // Ensure CORS headers are present on all API responses, not just those that
  // go through successResponse/errorResponse (catches uncaught errors, 500s, etc.)
  if (url.pathname.startsWith('/public_api/') || url.pathname.startsWith('/ext/')) {
    const corsHeaders = buildCorsHeaders(context.request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'");

  console.log(`[Middleware] ${method} ${url.pathname} → ${response.status}`);

  // Log to activity buffer
  const durationMs = Date.now() - startTime;
  const isApiPath = url.pathname.startsWith('/ext/') || url.pathname.startsWith('/public_api/');
  const isAdminPath = url.pathname.startsWith('/admin/');
  if (isApiPath || isAdminPath) {
    logActivity({
      level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
      category: isApiPath ? 'api_request' : 'system',
      message: `${method} ${url.pathname} → ${response.status}`,
      method,
      path: url.pathname,
      statusCode: response.status,
      durationMs,
    });
  }

  // Probabilistic retention cleanup on admin/API requests
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/public_api/')) {
    maybeTriggerCleanup();
  }

  return response;
};
