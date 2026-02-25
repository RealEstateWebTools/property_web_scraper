/**
 * Tests for scrape-handler.ts — parseScrapeBody and handleScrapeRequest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/services/haul-store.js', () => ({
  addScrapeToHaul: vi.fn(),
  findExistingScrapeByUrl: vi.fn(),
}));

vi.mock('../../src/lib/services/url-validator.js', () => ({
  validateUrl: vi.fn(),
  MISSING: 'missing',
  INVALID: 'invalid',
  UNSUPPORTED: 'unsupported',
}));

vi.mock('../../src/lib/extractor/mapping-loader.js', () => ({
  findByName: vi.fn(),
}));

vi.mock('../../src/lib/models/import-host.js', () => ({
  ImportHost: class ImportHost {
    host = '';
    scraper_name = '';
    slug = '';
  },
}));

vi.mock('../../src/lib/services/extraction-runner.js', () => ({
  runExtraction: vi.fn(),
}));

vi.mock('../../src/lib/services/listing-store.js', () => ({
  getListingByUrl: vi.fn(),
  getDiagnostics: vi.fn(),
}));

vi.mock('../../src/lib/pages-helpers/build-haul-scrape.js', () => ({
  buildHaulScrapeFromListing: vi.fn(),
}));

import { parseScrapeBody, handleScrapeRequest } from '../../src/lib/services/scrape-handler.js';
import { findExistingScrapeByUrl, addScrapeToHaul } from '../../src/lib/services/haul-store.js';
import { validateUrl } from '../../src/lib/services/url-validator.js';
import { findByName } from '../../src/lib/extractor/mapping-loader.js';
import { runExtraction } from '../../src/lib/services/extraction-runner.js';
import { getListingByUrl, getDiagnostics } from '../../src/lib/services/listing-store.js';
import { buildHaulScrapeFromListing } from '../../src/lib/pages-helpers/build-haul-scrape.js';

const MAX_HTML_SIZE = 10_000_000;

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/ext/v1/hauls/test-haul/scrapes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── parseScrapeBody ───────────────────────────────────────────────────────────

describe('parseScrapeBody', () => {
  const VALID_BODY = {
    url: 'https://www.rightmove.co.uk/properties/123',
    html: '<html><body>Listing content</body></html>',
  };

  it('returns parsed input for valid body', () => {
    const result = parseScrapeBody(VALID_BODY, makeRequest());
    expect(result).toEqual(VALID_BODY);
  });

  it('returns error Response when url is missing', async () => {
    const result = parseScrapeBody({ html: '<html></html>' }, makeRequest());
    expect(result).toBeInstanceOf(Response);
    const resp = result as Response;
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error?.code).toBe('MISSING_URL');
  });

  it('returns error Response when html is missing', async () => {
    const result = parseScrapeBody({ url: 'https://example.com' }, makeRequest());
    expect(result).toBeInstanceOf(Response);
    const resp = result as Response;
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error?.code).toBe('INVALID_REQUEST');
  });

  it('returns error Response when html exceeds 10MB', async () => {
    const hugeHtml = 'x'.repeat(MAX_HTML_SIZE + 1);
    const result = parseScrapeBody({ url: 'https://example.com', html: hugeHtml }, makeRequest());
    expect(result).toBeInstanceOf(Response);
    const resp = result as Response;
    expect(resp.status).toBe(413);
    const json = await resp.json();
    expect(json.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts html at exactly the size limit', () => {
    const exactHtml = 'x'.repeat(MAX_HTML_SIZE);
    const result = parseScrapeBody({ url: 'https://example.com', html: exactHtml }, makeRequest());
    expect(result).not.toBeInstanceOf(Response);
  });
});

// ── handleScrapeRequest ───────────────────────────────────────────────────────

describe('handleScrapeRequest', () => {
  const HAUL_ID = 'haul-abc123';
  const INPUT = {
    url: 'https://www.rightmove.co.uk/properties/999',
    html: '<html><body>Listing</body></html>',
  };

  it('returns 409 when URL already exists in haul', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue({
      resultId: 'r-1',
      title: 'Existing Property',
      grade: 'B',
      price: '£250,000',
      url: INPUT.url,
    } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.duplicate).toBe(true);
    expect(json.existing_scrape.result_id).toBe('r-1');
  });

  it('reuses existing listing if URL was extracted before', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue({
      id: 'listing-42',
      listing: { title: 'Cached Property', price_float: 300000 },
    } as any);
    vi.mocked(getDiagnostics).mockResolvedValue(undefined);
    vi.mocked(buildHaulScrapeFromListing).mockReturnValue({
      resultId: 'listing-42',
      title: 'Cached Property',
      grade: 'B',
      price: '£300,000',
      extractionRate: 0.8,
      createdAt: new Date().toISOString(),
      url: INPUT.url,
    } as any);
    vi.mocked(addScrapeToHaul).mockResolvedValue({ added: true, replaced: false } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.duplicate).toBe(true);
    expect(json.was_existing_listing).toBe(true);
  });

  it('returns error when haul is full for existing listing', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue({
      id: 'listing-x',
      listing: { title: 'Full Haul Prop', price_float: 200000 },
    } as any);
    vi.mocked(getDiagnostics).mockResolvedValue(undefined);
    vi.mocked(buildHaulScrapeFromListing).mockReturnValue({} as any);
    vi.mocked(addScrapeToHaul).mockResolvedValue({ added: false, replaced: false } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.message).toContain('full');
  });

  it('validates URL and falls back to generic_real_estate for unknown host', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue(undefined);
    vi.mocked(validateUrl).mockResolvedValue({
      valid: false,
      errorCode: 'unsupported',
      errorMessage: 'Unsupported host',
      importHost: null,
    } as any);
    vi.mocked(findByName).mockReturnValue({ name: 'generic_real_estate' } as any);
    vi.mocked(runExtraction).mockResolvedValue({
      listing: { title: 'Generic Property', price_float: 0, price_string: '' },
      resultId: 'r-generic',
      resultsUrl: '/extract/results/r-generic',
      fieldsExtracted: 5,
      fieldsAvailable: 10,
      diagnostics: { qualityGrade: 'C', extractionRate: 0.5 },
      wasExistingListing: false,
      wasUnchanged: false,
    } as any);
    vi.mocked(addScrapeToHaul).mockResolvedValue({ added: true, replaced: false } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.scrape.result_id).toBe('r-generic');
  });

  it('returns MISSING_SCRAPER error when validation fails with non-UNSUPPORTED code', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue(undefined);
    vi.mocked(validateUrl).mockResolvedValue({
      valid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'URL is malformed',
      importHost: null,
    } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(400);
  });

  it('returns 201 with scrape data on successful extraction', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue(undefined);
    vi.mocked(validateUrl).mockResolvedValue({
      valid: true,
      importHost: { host: 'rightmove.co.uk', scraper_name: 'uk_rightmove', slug: 'rightmove' },
    } as any);
    vi.mocked(findByName).mockReturnValue({ name: 'uk_rightmove' } as any);
    vi.mocked(runExtraction).mockResolvedValue({
      listing: { title: 'Nice Flat', price_float: 250000, price_string: '£250,000' },
      resultId: 'r-200',
      resultsUrl: '/extract/results/r-200',
      fieldsExtracted: 12,
      fieldsAvailable: 15,
      diagnostics: { qualityGrade: 'A', extractionRate: 0.8 },
      wasExistingListing: false,
      wasUnchanged: false,
    } as any);
    vi.mocked(addScrapeToHaul).mockResolvedValue({ added: true, replaced: false } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.scrape.result_id).toBe('r-200');
    expect(json.scrape.title).toBe('Nice Flat');
    expect(json.scrape.grade).toBe('A');
    expect(json.haul_id).toBe(HAUL_ID);
  });

  it('returns error when extraction returns null', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue(undefined);
    vi.mocked(validateUrl).mockResolvedValue({
      valid: true,
      importHost: { host: 'example.com', scraper_name: 'uk_rightmove', slug: 'rm' },
    } as any);
    vi.mocked(findByName).mockReturnValue({ name: 'uk_rightmove' } as any);
    vi.mocked(runExtraction).mockResolvedValue(null);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.message).toContain('Extraction failed');
  });

  it('returns haul_url in response', async () => {
    vi.mocked(findExistingScrapeByUrl).mockResolvedValue(undefined);
    vi.mocked(getListingByUrl).mockResolvedValue(undefined);
    vi.mocked(validateUrl).mockResolvedValue({
      valid: true,
      importHost: { host: 'example.com', scraper_name: 'uk_rightmove', slug: 'rm' },
    } as any);
    vi.mocked(findByName).mockReturnValue({ name: 'uk_rightmove' } as any);
    vi.mocked(runExtraction).mockResolvedValue({
      listing: { title: 'A Property', price_float: 0, price_string: '' },
      resultId: 'r-abc',
      resultsUrl: '/extract/results/r-abc',
      fieldsExtracted: 8,
      fieldsAvailable: 15,
      diagnostics: { qualityGrade: 'B', extractionRate: 0.6 },
      wasExistingListing: false,
      wasUnchanged: false,
    } as any);
    vi.mocked(addScrapeToHaul).mockResolvedValue({ added: true, replaced: false } as any);

    const response = await handleScrapeRequest(HAUL_ID, INPUT, makeRequest());
    const json = await response.json();

    expect(json.haul_url).toBe(`/haul/${HAUL_ID}`);
    expect(json.results_url).toBe('/extract/results/r-abc');
  });
});
