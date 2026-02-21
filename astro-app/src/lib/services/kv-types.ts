/**
 * Type definitions for KV store operations.
 * Mirrors the Cloudflare KV namespace interface for type safety
 * across all services that use KV storage.
 */

export interface KVPutOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

export interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}
