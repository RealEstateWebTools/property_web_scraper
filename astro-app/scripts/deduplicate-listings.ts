#!/usr/bin/env npx tsx
/**
 * deduplicate-listings.ts — Remove duplicate Firestore listing documents.
 *
 * A listing is a duplicate when two or more Firestore documents share the same
 * canonical URL (hostname + pathname, trailing-slash-normalised).  The most
 * recently updated document is kept; the rest are deleted.
 *
 * Usage:
 *   npx tsx scripts/deduplicate-listings.ts              # dry run (safe — no changes)
 *   npx tsx scripts/deduplicate-listings.ts --execute    # delete the duplicates
 *   npx tsx scripts/deduplicate-listings.ts --verbose    # show every document processed
 *
 * Credentials (any one of these approaches works):
 *
 *   Option A — env var (recommended):
 *     export GOOGLE_SERVICE_ACCOUNT_JSON=$(cat /path/to/service-account.json)
 *     npx tsx scripts/deduplicate-listings.ts
 *
 *   Option B — copy the value from Cloudflare Pages → Settings → Variables and paste it:
 *     GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
 *       npx tsx scripts/deduplicate-listings.ts
 *
 * Optional env vars:
 *   FIRESTORE_COLLECTION_PREFIX  — prepended to "listings" collection name (default: '')
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RestFirestoreClient, parseServiceAccountJson } from '../src/lib/firestore/rest-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--execute');
const VERBOSE = argv.includes('--verbose');

if (DRY_RUN) {
  console.log('\n⚠️  DRY RUN — no documents will be deleted.');
  console.log('   Pass --execute to perform the actual deletions.\n');
}

// ── Load .dev.vars if present ────────────────────────────────────────────────

function loadDevVars(): void {
  const path = resolve(__dirname, '..', '.dev.vars');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}
loadDevVars();

// ── Credentials ───────────────────────────────────────────────────────────────

const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  console.error('❌  GOOGLE_SERVICE_ACCOUNT_JSON is not set.\n');
  console.error('Get your service account key from:');
  console.error('  Firebase Console → Project Settings → Service Accounts → Generate new private key\n');
  console.error('Then run:');
  console.error('  export GOOGLE_SERVICE_ACCOUNT_JSON=$(cat /path/to/service-account.json)');
  console.error('  npx tsx scripts/deduplicate-listings.ts\n');
  process.exit(1);
}

let creds: ReturnType<typeof parseServiceAccountJson>;
try {
  creds = parseServiceAccountJson(serviceAccountJson);
} catch (err) {
  console.error('❌  Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', (err as Error).message);
  process.exit(1);
}

const PREFIX = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';

// ── deduplicationKey — must match url-canonicalizer.ts exactly ───────────────

function deduplicationKey(url: string): string {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return parsed.hostname.toLowerCase() + pathname;
  } catch {
    return url;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTimestamp(raw: unknown): number {
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') return new Date(raw).getTime() || 0;
  if (typeof raw === 'number') return raw;
  return 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const client = new RestFirestoreClient(creds);
  const listingsCol = `${PREFIX}listings`;
  const diagnosticsCol = `${PREFIX}diagnostics`;

  // ── Step 1: Fetch all listing documents ─────────────────────────────────────

  console.log(`Fetching all documents from "${listingsCol}" ...`);
  const snapshot = await client.collection(listingsCol).get();
  const docs = snapshot.docs;
  console.log(`Found ${docs.length} document(s)\n`);

  if (docs.length === 0) {
    console.log('Nothing to do — collection is empty.');
    return;
  }

  // ── Step 2: Group by canonical URL ──────────────────────────────────────────

  interface Entry {
    id: string;
    url: string;
    timestamp: number;
  }

  const groups = new Map<string, Entry[]>();
  let noUrlCount = 0;

  for (const doc of docs) {
    const data = doc.data() ?? {};
    const importUrl = (data.import_url as string) || '';

    if (!importUrl) {
      noUrlCount++;
      if (VERBOSE) console.log(`  ⚠  ${doc.id}  no import_url — skipped`);
      continue;
    }

    const key = deduplicationKey(importUrl);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: doc.id,
      url: importUrl,
      timestamp: toTimestamp(data.last_retrieved_at),
    });
  }

  if (noUrlCount > 0) {
    console.log(`Note: ${noUrlCount} document(s) have no import_url and were skipped.\n`);
  }

  // ── Step 3: Identify duplicates ──────────────────────────────────────────────

  const duplicateGroups = [...groups.entries()]
    .filter(([, group]) => group.length > 1);

  console.log(`Unique canonical URLs:  ${groups.size}`);
  console.log(`URLs with duplicates:   ${duplicateGroups.length}\n`);

  if (duplicateGroups.length === 0) {
    console.log('✅  No duplicates found — nothing to delete.');
    return;
  }

  // ── Step 4: Report ───────────────────────────────────────────────────────────

  let totalToDelete = 0;
  const toDelete: Entry[] = [];

  for (const [key, group] of duplicateGroups) {
    group.sort((a, b) => b.timestamp - a.timestamp);
    const [keeper, ...dupes] = group;

    const keepTs = keeper.timestamp ? new Date(keeper.timestamp).toISOString() : 'unknown';
    console.log(`  ${key}`);
    console.log(`    KEEP    ${keeper.id}  (${keepTs})`);
    for (const dupe of dupes) {
      const dupeTs = dupe.timestamp ? new Date(dupe.timestamp).toISOString() : 'unknown';
      console.log(`    DELETE  ${dupe.id}  (${dupeTs})`);
      toDelete.push(dupe);
      totalToDelete++;
    }
    console.log('');
  }

  console.log(`Will delete ${totalToDelete} of ${docs.length} listing document(s).`);
  console.log(`Associated diagnostics documents will also be removed.\n`);

  if (DRY_RUN) {
    console.log('ℹ️  Dry run complete.  Re-run with --execute to delete:\n');
    console.log('   npx tsx scripts/deduplicate-listings.ts --execute\n');
    return;
  }

  // ── Step 5: Delete ───────────────────────────────────────────────────────────

  console.log('Deleting ...\n');
  let deleted = 0;
  let errors = 0;

  for (const entry of toDelete) {
    // Delete listing document
    try {
      await client.collection(listingsCol).doc(entry.id).delete();
      process.stdout.write(`  ✅ listings/${entry.id}`);
      deleted++;
    } catch (err) {
      console.error(`  ❌ listings/${entry.id}: ${(err as Error).message}`);
      errors++;
      continue; // skip diagnostics if listing delete failed
    }

    // Delete associated diagnostics document (best-effort)
    try {
      await client.collection(diagnosticsCol).doc(entry.id).delete();
      process.stdout.write(`  +  diagnostics/${entry.id}`);
    } catch {
      // Diagnostics may not exist — silently ignore
    }

    process.stdout.write('\n');
  }

  console.log('');

  if (errors === 0) {
    console.log(`✅  Done — deleted ${deleted} duplicate listing document(s).\n`);
  } else {
    console.log(`⚠️  Done — deleted ${deleted}, failed ${errors}.`);
    console.log(`   Re-run with --execute to retry the failures.\n`);
    process.exit(1);
  }
}

run().catch((err: Error) => {
  console.error('\n❌  Fatal error:', err.message || err);
  process.exit(1);
});
