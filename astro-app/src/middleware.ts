import type { MiddlewareHandler } from 'astro';
import { validateEnv } from '@lib/services/env-validator.js';

export const onRequest: MiddlewareHandler = async (_context, next) => {
  validateEnv();

  const response = await next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return response;
};
