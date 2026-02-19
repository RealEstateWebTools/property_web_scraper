/**
 * File-system-backed KV store for local development.
 * Implements the subset of Cloudflare KV used by haul-store:
 *   put(key, value, { expirationTtl? })
 *   get(key, 'json')
 *
 * Activated when DEV_KV_PERSIST is set. Data stored under astro-app/.kv-data/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

interface StoredEntry {
  value: string;
  expiresAt?: number;
}

function safeFilename(key: string): string {
  return encodeURIComponent(key) + '.json';
}

export class DevKV {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  async put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void> {
    const entry: StoredEntry = { value };
    if (opts?.expirationTtl) {
      entry.expiresAt = Date.now() + opts.expirationTtl * 1000;
    }
    const filePath = join(this.dir, safeFilename(key));
    writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  }

  async get(key: string, type?: string): Promise<any> {
    const filePath = join(this.dir, safeFilename(key));
    if (!existsSync(filePath)) return null;

    let entry: StoredEntry;
    try {
      entry = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      try { unlinkSync(filePath); } catch { /* ignore */ }
      return null;
    }

    if (type === 'json') {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    return entry.value;
  }
}

let instance: DevKV | null = null;

export function getDevKV(): DevKV | null {
  if (instance) return instance;
  // Check for DEV_KV_PERSIST env var (works with Vite/Astro import.meta.env and process.env)
  const enabled =
    (typeof process !== 'undefined' && process.env?.DEV_KV_PERSIST) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV_KV_PERSIST);
  if (!enabled) return null;
  const dir = join(process.cwd(), '.kv-data');
  instance = new DevKV(dir);
  return instance;
}

/** Reset singleton — for testing only */
export function _resetDevKV(): void {
  instance = null;
}
