#!/usr/bin/env npx tsx
/**
 * stale-check.ts — Detect scrapers whose extraction quality has degraded.
 *
 * Since extraction requires Vite's import.meta.glob (for mapping loading),
 * this script delegates to `npx vitest run` with a dedicated test file
 * that generates the baseline or performs the comparison.
 *
 * Usage:
 *   npx tsx scripts/stale-check.ts --save         # save current as baseline
 *   npx tsx scripts/stale-check.ts                # check against baseline
 *   npx tsx scripts/stale-check.ts --threshold=15 # custom drop threshold (%)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASELINE_PATH = resolve(__dirname, '..', 'test', 'fixtures', 'quality-baseline.json');
const SNAPSHOT_PATH = resolve(__dirname, '..', 'test', 'fixtures', 'quality-snapshot.json');

// Parse args
const args: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=');
    args[key] = rest.join('=') || 'true';
  }
}

const saveBaseline = args['save'] === 'true';
const threshold = parseInt(args['threshold'] || '10', 10);

// Step 1: Generate current snapshot via vitest
console.log('  Running extraction against all fixtures...');
try {
  execSync('npx vitest run test/lib/stale-snapshot.test.ts --reporter=verbose 2>&1', {
    cwd: resolve(__dirname, '..'),
    stdio: 'pipe',
  });
} catch (err: any) {
  // Test might "fail" if generating snapshot file, that's OK
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error('Failed to generate snapshot. Error:', err.stderr?.toString() || err.message);
    process.exit(1);
  }
}

if (!existsSync(SNAPSHOT_PATH)) {
  console.error('Snapshot file not generated');
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));

if (saveBaseline) {
  writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(`✅ Saved baseline with ${snapshot.entries.length} scrapers`);
  process.exit(0);
}

// Step 2: Compare against baseline
if (!existsSync(BASELINE_PATH)) {
  console.error('No baseline found. Run with --save first:');
  console.error('  npm run stale-check -- --save');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
const baselineMap = new Map(baseline.entries.map((e: any) => [e.scraper, e]));

const GRADE_ORDER: Record<string, number> = { A: 4, B: 3, C: 2, F: 1 };
let staleCount = 0;

console.log(`\n🔍 Stale Scraper Check (threshold: ${threshold}% drop)\n`);
console.log(`   Baseline from: ${baseline.savedAt}\n`);

for (const entry of snapshot.entries) {
  const base = baselineMap.get(entry.scraper) as any;
  if (!base) {
    console.log(`  ${entry.scraper.padEnd(22)} 🆕 New (no baseline)`);
    continue;
  }

  const rateDrop = Math.round((base.extractionRate - entry.extractionRate) * 100);
  const gradeDropped = (GRADE_ORDER[entry.grade] ?? 0) < (GRADE_ORDER[base.grade] ?? 0);

  if (rateDrop > threshold || gradeDropped) {
    staleCount++;
    console.log(`  ${entry.scraper.padEnd(22)} ❌ STALE: ${base.grade}→${entry.grade}, rate -${rateDrop}%`);
  } else if (rateDrop > 0) {
    console.log(`  ${entry.scraper.padEnd(22)} ⚠️  Slight drop: -${rateDrop}%`);
  } else {
    console.log(`  ${entry.scraper.padEnd(22)} ✅ OK (${entry.grade}, ${Math.round(entry.extractionRate * 100)}%)`);
  }
}

console.log('');
if (staleCount > 0) {
  console.log(`❌ ${staleCount} stale scraper(s) detected\n`);
  process.exit(1);
} else {
  console.log(`✅ All scrapers within threshold\n`);
}
