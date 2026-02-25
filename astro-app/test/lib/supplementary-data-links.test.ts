import { describe, it, expect } from 'vitest';
import { SupplementaryDataService, type CountryLinkConfig } from '../../src/lib/services/supplementary-data-links.js';

describe('SupplementaryDataService', () => {
  it('merges DEFAULT and country links, dedupes by id, and sorts by priority', () => {
    const config: CountryLinkConfig = {
      DEFAULT: [
        {
          id: 'default-link',
          titleTemplate: 'Default Link',
          urlTemplate: 'https://example.com/default?pc={postal_code}',
          requireFields: ['postal_code'],
          priority: 50,
        },
      ],
      GB: [
        {
          id: 'country-link',
          titleTemplate: 'Country Link',
          urlTemplate: 'https://example.com/country?pc={postal_code}',
          requireFields: ['postal_code'],
          priority: 10,
        },
        {
          id: 'country-link',
          titleTemplate: 'Duplicate Country Link',
          urlTemplate: 'https://example.com/country-duplicate?pc={postal_code}',
          requireFields: ['postal_code'],
          priority: 20,
        },
      ],
    };

    const service = new SupplementaryDataService(config);
    const links = service.generateLinks({ country: 'GB', postal_code: 'SW1A 1AA' } as any);

    expect(links).toHaveLength(2);
    expect(links[0].id).toBe('country-link');
    expect(links[1].id).toBe('default-link');
    expect(links[0].priority).toBe(10);
    expect(links[1].priority).toBe(50);
  });

  it('supports requireAnyFields and excludeIfFields conditions', () => {
    const config: CountryLinkConfig = {
      US: [
        {
          id: 'needs-any',
          titleTemplate: 'Needs Any',
          urlTemplate: 'https://example.com/any?q={city}{postal_code}',
          requireAnyFields: ['city', 'postal_code'],
        },
        {
          id: 'exclude-spam',
          titleTemplate: 'Exclude Spam',
          urlTemplate: 'https://example.com/exclude?q={postal_code}',
          requireFields: ['postal_code'],
          excludeIfFields: ['deleted_at'],
        },
      ],
    };

    const service = new SupplementaryDataService(config);

    const linksWithoutCityOrPostcode = service.generateLinks({ country: 'US' } as any);
    expect(linksWithoutCityOrPostcode).toHaveLength(0);

    const linksWithPostcode = service.generateLinks({ country: 'US', postal_code: '10001' } as any);
    expect(linksWithPostcode.map((l) => l.id)).toEqual(['needs-any', 'exclude-spam']);

    const linksExcluded = service.generateLinks({
      country: 'US',
      postal_code: '10001',
      deleted_at: new Date(),
    } as any);
    expect(linksExcluded.map((l) => l.id)).toEqual(['needs-any']);
  });

  it('interpolates metadata templates and skips malformed URLs', () => {
    const config: CountryLinkConfig = {
      ES: [
        {
          id: 'meta-link',
          titleTemplate: 'Area {city}',
          descriptionTemplate: 'Info for {postal_code}',
          urlTemplate: 'https://example.com/{city}?pc={postal_code}',
          requireFields: ['city', 'postal_code'],
          sourceType: 'official',
          access: 'free',
          freshness: 'daily',
          geoLevel: 'postcode',
          intent: 'area_profile',
        },
        {
          id: 'bad-url',
          titleTemplate: 'Broken',
          urlTemplate: 'not-a-valid-url',
          requireFields: ['city'],
        },
      ],
    };

    const service = new SupplementaryDataService(config);
    const links = service.generateLinks({ country: 'ES', city: 'Madrid', postal_code: '28001' } as any);

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: 'meta-link',
      title: 'Area Madrid',
      description: 'Info for 28001',
      sourceType: 'official',
      access: 'free',
      freshness: 'daily',
      geoLevel: 'postcode',
      intent: 'area_profile',
    });
  });
});
