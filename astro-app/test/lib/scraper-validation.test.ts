import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';
import { fixtures } from '../fixtures/manifest.js';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', 'fixtures', `${name}.html`), 'utf-8');
}

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
          expect(props[field]).toEqual(value);
        });
      }
    });
  }
});
