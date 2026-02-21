import { describe, it, expect, beforeEach } from 'vitest';
import { runExtraction } from '../../src/lib/services/extraction-runner.js';
import { clearListingStore } from '../../src/lib/services/listing-store.js';
import { findByName } from '../../src/lib/extractor/mapping-loader.js';
import { ImportHost } from '../../src/lib/models/import-host.js';

/** Minimal HTML that the generic_real_estate scraper can extract a title from. */
const SAMPLE_HTML = `
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": "Test Property 123",
    "description": "A lovely home",
    "offers": { "price": "350000", "priceCurrency": "GBP" }
  }
  </script>
</head>
<body><h1>Test Property 123</h1></body>
</html>
`;

const SAMPLE_HTML_CHANGED = SAMPLE_HTML.replace('Test Property 123', 'Test Property 456');

function makeImportHost(): ImportHost {
  const host = new ImportHost();
  host.host = 'www.rightmove.co.uk';
  host.scraper_name = 'generic_real_estate';
  host.slug = 'generic';
  return host;
}

describe('runExtraction — wasUnchanged flag', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('wasUnchanged is false on first extraction of a URL', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const result = await runExtraction({
      html: SAMPLE_HTML,
      url: 'https://www.rightmove.co.uk/properties/100',
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });

    expect(result).not.toBeNull();
    expect(result!.wasUnchanged).toBe(false);
  });

  it('wasUnchanged is false when re-submitted with identical HTML (no hash cache)', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const opts = {
      html: SAMPLE_HTML,
      url: 'https://www.rightmove.co.uk/properties/200',
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html' as const,
    };

    // First extraction
    const first = await runExtraction(opts);
    expect(first).not.toBeNull();
    expect(first!.wasUnchanged).toBe(false);

    // Second extraction with identical HTML — no hash cache, so always re-extracts
    const second = await runExtraction(opts);
    expect(second).not.toBeNull();
    expect(second!.wasUnchanged).toBe(false);
    expect(second!.wasExistingListing).toBe(true);
  });

  it('wasUnchanged is false when re-submitted with different HTML', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const url = 'https://www.rightmove.co.uk/properties/300';

    const first = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(first!.wasUnchanged).toBe(false);

    const second = await runExtraction({
      html: SAMPLE_HTML + '<!-- extra comment -->',
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(second).not.toBeNull();
    expect(second!.wasUnchanged).toBe(false);
  });

  it('wasUnchanged is false when sourceType is result_html_update', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const url = 'https://www.rightmove.co.uk/properties/400';

    await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });

    const second = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'result_html_update',
    });
    expect(second).not.toBeNull();
    expect(second!.wasUnchanged).toBe(false);
  });

  it('wasUnchanged is false on re-extraction after listing store cleared', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const url = 'https://www.rightmove.co.uk/properties/500';

    const first = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(first!.wasUnchanged).toBe(false);

    // Clear in-memory listing store
    clearListingStore();

    // Second extraction: listing not in memory but still exists in Firestore
    const second = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(second).not.toBeNull();
    expect(second!.wasUnchanged).toBe(false);
  });
});
