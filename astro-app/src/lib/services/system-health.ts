/**
 * System health aggregation service.
 * Collects storage, environment, runtime, throughput, and subsystem health data.
 */

import { getStorageStatus } from '../firestore/client.js';
import type { StorageStatus } from '../firestore/types.js';
import { getEnvStatus } from './env-validator.js';
import type { EnvVarInfo } from './env-validator.js';
import { getLogStats, queryLogs } from './activity-logger.js';
import type { LogStats } from './activity-logger.js';
import { getRateLimiterStats } from './rate-limiter.js';
import { getCacheStats } from '../extractor/mapping-loader.js';
import { getStoreStats } from './listing-store.js';

export interface RuntimeInfo {
  platform: string;
  nodeVersion: string | null;
  uptime: number | null;
  memoryUsageMb: number | null;
}

export interface ThroughputInfo {
  totalRequests: number;
  requestsLastHour: number;
  requestsLastMinute: number;
  errorCount: number;
  warnCount: number;
  errorRate: number;
}

export interface SubsystemHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'error';
  detail: string;
}

export interface SystemHealthData {
  storage: StorageStatus;
  environment: EnvVarInfo[];
  runtime: RuntimeInfo;
  throughput: ThroughputInfo;
  subsystems: SubsystemHealth[];
  logs: LogStats;
}

function detectPlatform(): string {
  if (typeof globalThis.navigator !== 'undefined' && 'userAgent' in globalThis.navigator) {
    const ua = globalThis.navigator.userAgent;
    if (ua.includes('Cloudflare-Workers')) return 'cloudflare';
  }
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  return 'unknown';
}

function getRuntimeInfo(): RuntimeInfo {
  const platform = detectPlatform();
  let nodeVersion: string | null = null;
  let uptime: number | null = null;
  let memoryUsageMb: number | null = null;

  if (typeof process !== 'undefined') {
    nodeVersion = process.versions?.node || null;
    if (typeof process.uptime === 'function') {
      uptime = Math.floor(process.uptime());
    }
    if (typeof process.memoryUsage === 'function') {
      const mem = process.memoryUsage();
      memoryUsageMb = Math.round(mem.rss / 1024 / 1024);
    }
  }

  return { platform, nodeVersion, uptime, memoryUsageMb };
}

function computeThroughput(): ThroughputInfo {
  const logStats = getLogStats();
  const now = Date.now();
  const oneHourAgo = now - 3600_000;
  const oneMinuteAgo = now - 60_000;

  // Use queryLogs to count recent requests
  const lastHourLogs = queryLogs({ category: 'api_request', limit: 1000 });
  const requestsLastHour = lastHourLogs.entries.filter(
    (e) => e.timestamp >= oneHourAgo
  ).length;
  const requestsLastMinute = lastHourLogs.entries.filter(
    (e) => e.timestamp >= oneMinuteAgo
  ).length;

  const errorCount = logStats.byLevel.error;
  const warnCount = logStats.byLevel.warn;
  const totalRequests = logStats.byCategory.api_request;
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  return {
    totalRequests,
    requestsLastHour,
    requestsLastMinute,
    errorCount,
    warnCount,
    errorRate,
  };
}

function assessSubsystems(): SubsystemHealth[] {
  const subsystems: SubsystemHealth[] = [];

  // Rate limiter
  const rlStats = getRateLimiterStats();
  subsystems.push({
    name: 'Rate Limiter',
    status: 'healthy',
    detail: `${rlStats.activeClients} active clients, ${rlStats.totalRequests} tracked requests`,
  });

  // Storage
  const storage = getStorageStatus();
  if (storage.error) {
    subsystems.push({
      name: 'Storage',
      status: 'error',
      detail: storage.error,
    });
  } else {
    subsystems.push({
      name: 'Storage',
      status: 'healthy',
      detail: `${storage.backend} backend${storage.projectId ? ` (${storage.projectId})` : ''}`,
    });
  }

  // Mapping cache
  const cacheStats = getCacheStats();
  subsystems.push({
    name: 'Mapping Cache',
    status: 'healthy',
    detail: `${cacheStats.size} mappings cached`,
  });

  // Listing store
  const storeStats = getStoreStats();
  subsystems.push({
    name: 'Listing Store',
    status: 'healthy',
    detail: `${storeStats.count} listings stored`,
  });

  return subsystems;
}

export function getSystemHealth(): SystemHealthData {
  return {
    storage: getStorageStatus(),
    environment: getEnvStatus(),
    runtime: getRuntimeInfo(),
    throughput: computeThroughput(),
    subsystems: assessSubsystems(),
    logs: getLogStats(),
  };
}
