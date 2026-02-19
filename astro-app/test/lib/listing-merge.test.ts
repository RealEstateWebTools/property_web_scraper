import { describe, it, expect } from 'vitest';
import { Listing } from '../../src/lib/models/listing.js';
import type { MergeDiff } from '../../src/lib/models/listing.js';

function makeListing(attrs: Record<string, unknown>): Listing {
  const listing = new Listing();
  listing.assignAttributes(attrs);
  return listing;
}

describe('Listing.mergeIntoListing', () => {
  it('fills empty fields from incoming', () => {
    const existing = makeListing({ import_url: 'https://example.com/1', title: '' });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      title: 'Lovely Flat',
      city: 'London',
      count_bedrooms: 3,
    });

    const diff = Listing.mergeIntoListing(existing, incoming);

    expect(existing.title).toBe('Lovely Flat');
    expect(existing.city).toBe('London');
    expect(existing.count_bedrooms).toBe(3);
    expect(diff.fieldsAdded).toContain('title');
    expect(diff.fieldsAdded).toContain('city');
    expect(diff.fieldsAdded).toContain('count_bedrooms');
    expect(diff.wasExistingListing).toBe(true);
  });

  it('preserves existing non-empty text when incoming is empty', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      title: 'Existing Title',
      city: 'Madrid',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      title: '',
      city: '',
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.title).toBe('Existing Title');
    expect(existing.city).toBe('Madrid');
  });

  it('prefers richer (longer) description', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      description: 'Short',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      description: 'A much longer and more detailed description of the property',
    });

    const diff = Listing.mergeIntoListing(existing, incoming);

    expect(existing.description).toBe('A much longer and more detailed description of the property');
    expect(diff.fieldsOverwritten).toContain('description');
  });

  it('keeps existing description when incoming is shorter', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      description: 'A very detailed and comprehensive property description with lots of info',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      description: 'Short',
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.description).toBe('A very detailed and comprehensive property description with lots of info');
  });

  it('merges image_urls by deduplicating on URL', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      image_urls: [{ url: 'https://img.com/1.jpg' }, { url: 'https://img.com/2.jpg' }],
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      image_urls: [{ url: 'https://img.com/2.jpg' }, { url: 'https://img.com/3.jpg' }],
    });

    Listing.mergeIntoListing(existing, incoming);

    const urls = existing.image_urls.map((img) => img.url);
    expect(urls).toContain('https://img.com/1.jpg');
    expect(urls).toContain('https://img.com/2.jpg');
    expect(urls).toContain('https://img.com/3.jpg');
    expect(urls).toHaveLength(3);
  });

  it('prefers incoming images outright when strictly more', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      image_urls: [{ url: 'https://img.com/old.jpg' }],
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      image_urls: [
        { url: 'https://img.com/new1.jpg' },
        { url: 'https://img.com/new2.jpg' },
        { url: 'https://img.com/new3.jpg' },
      ],
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.image_urls).toHaveLength(3);
    expect(existing.image_urls[0].url).toBe('https://img.com/new1.jpg');
  });

  it('deduplicates features by lowercase', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      features: ['Pool', 'Garden'],
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      features: ['garden', 'Parking'],
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.features).toHaveLength(3);
    const lower = existing.features.map((f) => f.toLowerCase());
    expect(lower).toContain('pool');
    expect(lower).toContain('garden');
    expect(lower).toContain('parking');
  });

  it('always takes latest price (latest-wins)', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      price_string: '250,000',
      price_float: 250000,
      price_cents: 25000000,
      price_currency: 'EUR',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      price_string: '275,000',
      price_float: 275000,
      price_cents: 27500000,
      price_currency: 'EUR',
    });

    const diff = Listing.mergeIntoListing(existing, incoming);

    expect(existing.price_string).toBe('275,000');
    expect(existing.price_float).toBe(275000);
    expect(existing.price_cents).toBe(27500000);
    expect(diff.fieldsOverwritten).toContain('price_string');
  });

  it('preserves existing non-zero numeric when incoming is zero', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      count_bedrooms: 3,
      constructed_area: 120,
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      count_bedrooms: 0,
      constructed_area: 0,
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.count_bedrooms).toBe(3);
    expect(existing.constructed_area).toBe(120);
  });

  it('never overwrites immutable fields', () => {
    const existing = makeListing({
      import_url: 'https://example.com/original',
      import_host_slug: 'rightmove',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/different',
      import_host_slug: 'zoopla',
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.import_url).toBe('https://example.com/original');
    expect(existing.import_host_slug).toBe('rightmove');
  });

  it('returns accurate MergeDiff', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      title: 'Old Title',
      city: '',
      count_bedrooms: 0,
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      title: 'New Title',
      city: 'Barcelona',
      count_bedrooms: 4,
    });

    const diff = Listing.mergeIntoListing(existing, incoming);

    expect(diff.fieldsChanged).toContain('title');
    expect(diff.fieldsChanged).toContain('city');
    expect(diff.fieldsChanged).toContain('count_bedrooms');
    expect(diff.fieldsOverwritten).toContain('title');
    expect(diff.fieldsAdded).toContain('city');
    expect(diff.fieldsAdded).toContain('count_bedrooms');
    expect(diff.wasExistingListing).toBe(true);
  });

  it('records a timestamped entry in import_history', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      title: 'New Title',
    });

    Listing.mergeIntoListing(existing, incoming);

    const keys = Object.keys(existing.import_history);
    expect(keys.length).toBe(1);
    const entry = existing.import_history[keys[0]] as Record<string, unknown>;
    expect(entry.action).toBe('merge');
    expect(typeof entry.fieldsChanged).toBe('number');
  });

  it('handles boolean latest-wins fields correctly', () => {
    const existing = makeListing({
      import_url: 'https://example.com/1',
      sold: false,
      for_sale: true,
    });
    const incoming = makeListing({
      import_url: 'https://example.com/1',
      sold: true,
      for_sale: false,
    });

    Listing.mergeIntoListing(existing, incoming);

    expect(existing.sold).toBe(true);
    expect(existing.for_sale).toBe(false);
  });
});
