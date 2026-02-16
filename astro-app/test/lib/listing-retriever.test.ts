import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { retrieveListing } from '../../src/lib/services/listing-retriever.js';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', 'fixtures', `${name}.html`), 'utf-8');
}

describe('retrieveListing', () => {
  it('returns error for invalid URL', async () => {
    const result = await retrieveListing('not-a-valid-url');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid Url');
  });

  it('returns error for unsupported host', async () => {
    const result = await retrieveListing('https://www.unsupported-site-xyz.com/listing/123');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Unsupported Url');
  });

  it('returns error for empty URL', async () => {
    const result = await retrieveListing('');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid Url');
  });

  it('succeeds with valid URL and HTML', async () => {
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing).toBeDefined();
    expect(result.retrievedListing!.title).toBe(
      '4 bedroom detached house to rent in School Road, Birmingham, B14, B14'
    );
  });

  it('returns listing with diagnostics when HTML is provided', async () => {
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.scraperName).toBe('rightmove');
    expect(result.diagnostics!.populatedFields).toBeGreaterThan(0);
  });

  it('returns undefined diagnostics in URL-only mode', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeUndefined();
    expect(result.retrievedListing).toBeDefined();
  });

  it('handles valid URL with empty HTML string as URL-only mode', async () => {
    // Empty string is falsy, so retrieveListing treats it as URL-only mode
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999.html',
      '',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeUndefined();
  });

  it('handles valid URL with no-data HTML', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999.html',
      '<html><body><p>Nothing useful</p></body></html>',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.emptyFields.length).toBeGreaterThan(0);
  });

  it('sets import_host_slug on listing when extraction succeeds', async () => {
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing!.import_host_slug).toBe('rightmove');
  });

  it('works with idealista URL and fixture', async () => {
    const html = loadFixture('idealista_2018_01');
    const result = await retrieveListing(
      'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing!.title).toBe('Piso en venta en goya, 54, Goya, Madrid');
    expect(result.diagnostics!.scraperName).toBe('idealista');
  });
});
