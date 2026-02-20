/**
 * Centralized KV initialization for all services.
 * Call once per request from middleware to ensure every service
 * has access to the KV binding. Eliminates the per-endpoint init ceremony.
 */

import { resolveKV } from './kv-resolver.js';
import { initKV } from './listing-store.js';
import { initHaulKV } from './haul-store.js';
import { initScrapeMetadataKV } from './scrape-metadata.js';
import { initPriceHistoryKV } from './price-history.js';
import { initWebhookKV } from './webhook-service.js';
import { initExportHistoryKV } from './export-history.js';
import { initUsageKV } from './usage-meter.js';
import { initUsersKV } from './api-key-service.js';
import { initRateLimiterKV } from './rate-limiter.js';

export function initAllKV(locals: unknown): void {
  const binding = resolveKV(locals);
  initKV(binding);
  initHaulKV(binding);
  initScrapeMetadataKV(binding);
  initPriceHistoryKV(binding);
  initWebhookKV(binding);
  initExportHistoryKV(binding);
  initUsageKV(binding);
  initUsersKV(binding);
  initRateLimiterKV(binding);
}
