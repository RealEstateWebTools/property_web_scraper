import { describe, it, expect, beforeEach } from 'vitest';
import { getSystemHealth } from '../../src/lib/services/system-health.js';
import { getEnvStatus } from '../../src/lib/services/env-validator.js';
import { logActivity, clearLogs } from '../../src/lib/services/activity-logger.js';

describe('System Health', () => {
  beforeEach(() => {
    clearLogs();
  });

  describe('getSystemHealth', () => {
    it('returns all required sections', () => {
      const health = getSystemHealth();
      expect(health).toHaveProperty('storage');
      expect(health).toHaveProperty('environment');
      expect(health).toHaveProperty('runtime');
      expect(health).toHaveProperty('throughput');
      expect(health).toHaveProperty('subsystems');
      expect(health).toHaveProperty('logs');
    });

    it('storage section has expected shape', () => {
      const { storage } = getSystemHealth();
      expect(storage).toHaveProperty('backend');
      expect(storage).toHaveProperty('connected');
      expect(storage).toHaveProperty('projectId');
      expect(storage).toHaveProperty('error');
    });

    it('runtime section detects node platform', () => {
      const { runtime } = getSystemHealth();
      expect(runtime.platform).toBe('node');
      expect(runtime.nodeVersion).toBeTruthy();
      expect(typeof runtime.uptime).toBe('number');
    });

    it('runtime section reports memory usage', () => {
      const { runtime } = getSystemHealth();
      expect(runtime.memoryUsageMb).toBeGreaterThan(0);
    });

    it('subsystems includes expected components', () => {
      const { subsystems } = getSystemHealth();
      const names = subsystems.map((s) => s.name);
      expect(names).toContain('Rate Limiter');
      expect(names).toContain('Storage');
      expect(names).toContain('Mapping Cache');
      expect(names).toContain('Listing Store');
    });

    it('subsystems have valid status values', () => {
      const { subsystems } = getSystemHealth();
      for (const sub of subsystems) {
        expect(['healthy', 'degraded', 'error']).toContain(sub.status);
        expect(sub.detail).toBeTruthy();
      }
    });
  });

  describe('throughput computation', () => {
    it('counts zero requests when no logs exist', () => {
      const { throughput } = getSystemHealth();
      expect(throughput.totalRequests).toBe(0);
      expect(throughput.requestsLastHour).toBe(0);
      expect(throughput.requestsLastMinute).toBe(0);
      expect(throughput.errorRate).toBe(0);
    });

    it('counts api_request logs', () => {
      logActivity({ level: 'info', category: 'api_request', message: 'GET /api/extract' });
      logActivity({ level: 'info', category: 'api_request', message: 'POST /api/extract' });
      logActivity({ level: 'error', category: 'api_request', message: 'Failed request' });

      const { throughput } = getSystemHealth();
      expect(throughput.totalRequests).toBe(3);
      expect(throughput.requestsLastMinute).toBe(3);
      expect(throughput.requestsLastHour).toBe(3);
    });

    it('computes error rate', () => {
      logActivity({ level: 'info', category: 'api_request', message: 'ok' });
      logActivity({ level: 'error', category: 'api_request', message: 'fail' });

      const { throughput } = getSystemHealth();
      // 1 error out of 2 total api_requests
      expect(throughput.errorCount).toBe(1);
      expect(throughput.errorRate).toBeCloseTo(0.5);
    });

    it('tracks warnings separately', () => {
      logActivity({ level: 'warn', category: 'rate_limit', message: 'rate limited' });
      logActivity({ level: 'warn', category: 'system', message: 'something' });

      const { throughput } = getSystemHealth();
      expect(throughput.warnCount).toBe(2);
    });
  });

  describe('getEnvStatus', () => {
    it('returns array of env var info', () => {
      const status = getEnvStatus();
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
    });

    it('each entry has required fields', () => {
      const status = getEnvStatus();
      for (const entry of status) {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('configured');
        expect(entry).toHaveProperty('required');
        expect(entry).toHaveProperty('description');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.configured).toBe('boolean');
        expect(typeof entry.required).toBe('boolean');
        expect(typeof entry.description).toBe('string');
      }
    });

    it('includes known env vars', () => {
      const status = getEnvStatus();
      const names = status.map((e) => e.name);
      expect(names).toContain('FIRESTORE_PROJECT_ID');
      expect(names).toContain('GOOGLE_SERVICE_ACCOUNT_JSON');
      expect(names).toContain('PWS_API_KEY');
      expect(names).toContain('PWS_ADMIN_KEY');
      expect(names).toContain('PWS_ALLOWED_ORIGINS');
    });

    it('detects configured env vars', () => {
      const status = getEnvStatus();
      const firestoreProject = status.find((e) => e.name === 'FIRESTORE_PROJECT_ID');
      // Set in test/setup.ts
      expect(firestoreProject?.configured).toBe(true);
    });
  });
});
