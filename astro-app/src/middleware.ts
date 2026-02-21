import type { MiddlewareHandler } from 'astro';
import { validateEnv } from '@lib/services/env-validator.js';
import { corsPreflightResponse, buildCorsHeaders } from '@lib/services/api-response.js';
import { initAllKV } from '@lib/services/kv-init.js';

export const onRequest: MiddlewareHandler = async (context, next) => {
  validateEnv();
  initAllKV(context.locals);

  const { method } = context.request;
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('origin');

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
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'");

  console.log(`[Middleware] ${method} ${url.pathname} → ${response.status}`);

  return response;
};
