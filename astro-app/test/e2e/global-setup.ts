import { rmSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Playwright global setup: clean miniflare KV SQLite files so haul tests
 * start fresh (no stale free-haul:{ip} entries from previous runs).
 * Deletes only the SQLite files, not the directory structure — miniflare
 * recreates them on startup.
 */
export default function globalSetup() {
  const kvDir = resolve(__dirname, '../../.wrangler/state/v3/kv/miniflare-KVNamespaceObject');
  if (!existsSync(kvDir)) return;

  try {
    for (const file of readdirSync(kvDir)) {
      if (file.endsWith('.sqlite') || file.endsWith('.sqlite-shm') || file.endsWith('.sqlite-wal')) {
        rmSync(join(kvDir, file), { force: true });
      }
    }
  } catch {
    // Directory may not exist on first run
  }
}
