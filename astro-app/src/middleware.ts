import type { MiddlewareHandler } from 'astro';
import { validateEnv } from '@lib/services/env-validator.js';
import { corsPreflightResponse } from '@lib/services/api-response.js';

export const onRequest: MiddlewareHandler = async (context, next) => {
  validateEnv();

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

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  console.log(`[Middleware] ${method} ${url.pathname} → ${response.status}`);

  return response;
};
