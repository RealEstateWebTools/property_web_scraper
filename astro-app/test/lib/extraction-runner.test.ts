import { describe, it, expect, beforeEach } from 'vitest';
import { runExtraction } from '../../src/lib/services/extraction-runner.js';
import { clearListingStore, initKV } from '../../src/lib/services/listing-store.js';
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

function makeMockKV() {
  const kvData = new Map<string, string>();
  return {
    kv: {
      put: async (key: string, value: string, _opts?: any) => { kvData.set(key, value); },
      get: async (key: string, _type?: string) => {
        const val = kvData.get(key);
        return val ? JSON.parse(val) : null;
      },
    },
    kvData,
  };
}

describe('runExtraction — wasUnchanged flag', () => {
  beforeEach(() => {
    clearListingStore();
    initKV(null);
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

  it('wasUnchanged is true when re-submitted with identical HTML', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const { kv } = makeMockKV();
    initKV(kv);

    const opts = {
      html: SAMPLE_HTML,
      url: 'https://www.rightmove.co.uk/properties/200',
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html' as const,
    };

    // First extraction — stores hash and listing
    const first = await runExtraction(opts);
    expect(first).not.toBeNull();
    expect(first!.wasUnchanged).toBe(false);

    // Second extraction with identical HTML — should short-circuit
    const second = await runExtraction(opts);
    expect(second).not.toBeNull();
    expect(second!.wasUnchanged).toBe(true);
    expect(second!.fieldsExtracted).toBe(0);
  });

  it('wasUnchanged is false when re-submitted with different HTML of different length', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const { kv } = makeMockKV();
    initKV(kv);

    const url = 'https://www.rightmove.co.uk/properties/300';

    const first = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(first!.wasUnchanged).toBe(false);

    // Different HTML (different length so size pre-check fails immediately)
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

  it('wasUnchanged is false when sourceType is result_html_update (bypass)', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    const { kv } = makeMockKV();
    initKV(kv);

    const url = 'https://www.rightmove.co.uk/properties/400';

    // Store hash via first extraction
    await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });

    // Re-submit with result_html_update — should always re-extract
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

  it('wasUnchanged is false when hash matches but listing has expired (no cached listing)', async () => {
    const scraperMapping = findByName('generic_real_estate');
    expect(scraperMapping).not.toBeNull();

    // KV that stores hash but NOT listings (simulates listing expiry)
    const hashData = new Map<string, string>();
    const hashOnlyKV = {
      put: async (key: string, value: string, _opts?: any) => {
        if (key.startsWith('html-hash:')) {
          hashData.set(key, value);
        }
        // Don't store listings — simulate expiry
      },
      get: async (key: string, _type?: string) => {
        const val = hashData.get(key);
        return val ? JSON.parse(val) : null;
      },
    };
    initKV(hashOnlyKV);

    const url = 'https://www.rightmove.co.uk/properties/500';

    // First extraction — stores hash (but not listing in KV)
    const first = await runExtraction({
      html: SAMPLE_HTML,
      url,
      scraperMapping: scraperMapping!,
      importHost: makeImportHost(),
      sourceType: 'manual_html',
    });
    expect(first!.wasUnchanged).toBe(false);

    // Clear in-memory listing store to simulate "listing expired from memory"
    clearListingStore();
    initKV(hashOnlyKV); // re-init after clearListingStore resets kv

    // Second extraction: hash matches but listing is not retrievable
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
