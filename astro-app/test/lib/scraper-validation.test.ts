import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';
import { findByName } from '../../src/lib/extractor/mapping-loader.js';
import { fixtures, getTestableFixtures, getMissingFixtures, getCoverageSummary } from '../fixtures/manifest.js';

function loadFixture(name: string): string {
  const path = resolve(__dirname, '..', 'fixtures', `${name}.html`);
  if (!existsSync(path)) {
    throw new Error(`Fixture file not found: ${path}\nRun: npx tsx scripts/capture-fixture.ts <listing-url>`);
  }
  return readFileSync(path, 'utf-8');
}

// ─── Coverage report ────────────────────────────────────────────

describe('Scraper validation coverage', () => {
  const summary = getCoverageSummary();

  it(`has ${summary.withFixture}/${summary.total} scrapers with fixtures (${summary.coveragePercent}%)`, () => {
    // This test always passes — it's a visibility marker
    expect(summary.withFixture).toBeGreaterThan(0);
  });

  it(`validates ${summary.totalExpectedFields} total expected fields`, () => {
    expect(summary.totalExpectedFields).toBeGreaterThan(0);
  });

  it('lists scrapers missing fixtures', () => {
    const missing = getMissingFixtures();
    if (missing.length > 0) {
      console.log(
        `\n⚠️  Scrapers without fixtures (${missing.length}):\n` +
        missing.map(m => `   - ${m.scraper}`).join('\n') +
        '\n   Run: npx tsx scripts/capture-fixture.ts <url>\n'
      );
    }
    // Not a failure — informational only
    expect(true).toBe(true);
  });
});

// ─── Per-scraper validation ─────────────────────────────────────

describe('Scraper validation', () => {
  for (const entry of fixtures) {
    describe(`${entry.scraper} scraper`, () => {
      if (!entry.fixture) {
        it.skip(`no fixture HTML yet for ${entry.scraper}`, () => {});
        return;
      }

      if (Object.keys(entry.expected).length === 0) {
        it.skip(`no expected values defined yet for ${entry.scraper}`, () => {});
        return;
      }

      const html = loadFixture(entry.fixture);
      const result = extractFromHtml({
        html,
        sourceUrl: entry.sourceUrl,
        scraperMappingName: entry.scraper,
      });

      it('extracts successfully', () => {
        expect(result.success).toBe(true);
        expect(result.properties).toHaveLength(1);
      });

      const props = result.properties[0] ?? {};

      for (const [field, value] of Object.entries(entry.expected)) {
        it(`extracts ${field}`, () => {
          const actual = props[field];
          if (actual === undefined) {
            throw new Error(
              `Field "${field}" is undefined in extracted data.\n` +
              `Expected: ${JSON.stringify(value)}\n` +
              `Available fields: ${Object.keys(props).sort().join(', ')}`
            );
          }
          expect(actual).toEqual(value);
        });
      }

      it('meets expected extraction rate', () => {
        const diag = result.diagnostics!;
        expect(diag).toBeDefined();
        const mapping = findByName(entry.scraper);
        if (mapping?.expectedExtractionRate != null) {
          expect(diag.extractionRate).toBeGreaterThanOrEqual(mapping.expectedExtractionRate);
        }
      });

      it('meets expected quality grade', () => {
        const diag = result.diagnostics!;
        expect(diag).toBeDefined();
        expect(diag.meetsExpectation).toBe(true);
      });
    });
  }
});

// ─── Mapping consistency ────────────────────────────────────────

describe('Manifest ↔ mapping consistency', () => {
  for (const entry of fixtures) {
    it(`${entry.scraper} has a matching scraper mapping file`, () => {
      const mapping = findByName(entry.scraper);
      expect(mapping).toBeDefined();
    });
  }

  it('all fixtures reference unique scrapers', () => {
    const scrapers = fixtures.map(f => f.scraper);
    const dupes = scrapers.filter((s, i) => scrapers.indexOf(s) !== i);
    expect(dupes).toEqual([]);
  });

  it('all fixture HTML files exist on disk', () => {
    const missing: string[] = [];
    for (const entry of fixtures) {
      if (entry.fixture) {
        const path = resolve(__dirname, '..', 'fixtures', `${entry.fixture}.html`);
        if (!existsSync(path)) {
          missing.push(`${entry.scraper} → ${entry.fixture}.html`);
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(`Missing fixture files:\n${missing.map(m => `  - ${m}`).join('\n')}`);
    }
  });
});
