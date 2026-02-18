/**
 * stale-snapshot.test.ts — Generate a quality snapshot for the stale-check tool.
 *
 * This test runs inside Vitest where import.meta.glob is available,
 * extracts from all fixtures, and writes a snapshot JSON file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';
import { fixtures, getFixtureSource } from '../fixtures/manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');
const SNAPSHOT_PATH = resolve(FIXTURES_DIR, 'quality-snapshot.json');

describe('stale-snapshot', () => {
  it('generates quality snapshot for all fixtures', () => {
    const entries: Array<{
      scraper: string;
      source: 'browser' | 'server-fetched';
      grade: string;
      extractionRate: number;
      populatedFields: number;
      totalFields: number;
    }> = [];

    for (const entry of fixtures) {
      if (!entry.fixture) continue;

      const fixturePath = resolve(FIXTURES_DIR, `${entry.fixture}.html`);
      if (!existsSync(fixturePath)) continue;

      const html = readFileSync(fixturePath, 'utf-8');
      const result = extractFromHtml({
        html,
        sourceUrl: entry.sourceUrl,
        scraperMappingName: entry.scraper,
      });

      const diag = result.diagnostics;
      entries.push({
        scraper: entry.scraper,
        source: getFixtureSource(entry),
        grade: diag?.qualityGrade || 'F',
        extractionRate: diag?.extractionRate || 0,
        populatedFields: diag?.populatedFields || 0,
        totalFields: diag?.totalFields || 0,
      });
    }

    const snapshot = { entries, savedAt: new Date().toISOString() };
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

    expect(entries.length).toBeGreaterThan(0);
  });
});
