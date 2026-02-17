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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');
const SNAPSHOT_PATH = resolve(FIXTURES_DIR, 'quality-snapshot.json');

const FIXTURE_MAP: Record<string, string> = {
  us_realtor: 'realtor',
  uk_rightmove: 'rightmove_v2',
  uk_zoopla: 'zoopla_v2',
  es_idealista: 'idealista_v2',
  es_fotocasa: 'fotocasa',
  es_pisos: 'pisos_dot_com',
  in_realestateindia: 'realestateindia',
  us_mlslistings: 'mlslistings',
  us_wyomingmls: 'wyomingmls',
  us_forsalebyowner: 'forsalebyowner',
  uk_jitty: 'uk_jitty',
  uk_onthemarket: 'onthemarket',
  ie_daft: 'daft',
};

describe('stale-snapshot', () => {
  it('generates quality snapshot for all fixtures', () => {
    const entries: Array<{
      scraper: string;
      grade: string;
      extractionRate: number;
      populatedFields: number;
      totalFields: number;
    }> = [];

    for (const [scraper, fixtureName] of Object.entries(FIXTURE_MAP)) {
      const fixturePath = resolve(FIXTURES_DIR, `${fixtureName}.html`);
      if (!existsSync(fixturePath)) continue;

      const html = readFileSync(fixturePath, 'utf-8');
      const result = extractFromHtml({
        html,
        sourceUrl: `https://fixture.test/${scraper}`,
        scraperMappingName: scraper,
      });

      const diag = result.diagnostics;
      entries.push({
        scraper,
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
