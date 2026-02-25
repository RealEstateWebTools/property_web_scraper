import type { Listing } from '../models/listing.js';

export interface SupplementaryLinkConfig {
  titleTemplate: string;
  urlTemplate: string;
  condition: (listing: Partial<Listing>) => boolean;
}

export type CountryLinkConfig = Record<string, SupplementaryLinkConfig[]>;

// Configuration storage for how to generate links per country
const DEFAULT_LINK_CONFIGS: CountryLinkConfig = {
  UK: [
    {
      titleTemplate: 'Doogal Postcode Data',
      urlTemplate: 'https://www.doogal.co.uk/UKPostcodes.php?Search={postal_code}',
      condition: (listing) => !!listing.postal_code,
    },
    {
      titleTemplate: 'Mouseprice Property Data',
      urlTemplate: 'https://www.mouseprice.com/property-for-sale/refine?search={postal_code}',
      condition: (listing) => !!listing.postal_code,
    },
  ],
  GB: [
    {
      titleTemplate: 'Doogal Postcode Data',
      urlTemplate: 'https://www.doogal.co.uk/UKPostcodes.php?Search={postal_code}',
      condition: (listing) => !!listing.postal_code,
    },
    {
      titleTemplate: 'Mouseprice Property Data',
      urlTemplate: 'https://www.mouseprice.com/property-for-sale/refine?search={postal_code}',
      condition: (listing) => !!listing.postal_code,
    },
  ],
  ES: [
    {
      titleTemplate: 'Idealista Area Guide',
      urlTemplate: 'https://www.idealista.com/en/areas/{postal_code}',
      condition: (listing) => !!listing.postal_code,
    },
  ],
  US: [
    {
      titleTemplate: 'Zip Code Data',
      urlTemplate: 'https://www.unitedstateszipcodes.org/{postal_code}/',
      condition: (listing) => !!listing.postal_code,
    },
  ]
};

export class SupplementaryDataService {
  private configs: CountryLinkConfig;

  constructor(customConfigs?: CountryLinkConfig) {
    this.configs = customConfigs || DEFAULT_LINK_CONFIGS;
  }

  /**
   * Calculates which lists to generate for which property and
   * constructs the formatted links based on configured templates.
   */
  generateLinks(listing: Partial<Listing>): { title: string; url: string }[] {
    const country = (listing.country || '').trim().toUpperCase();
    const result: { title: string; url: string }[] = [];

    // Fallback if country is not set but we have region or want generic lists
    const countryConfigs = this.configs[country];
    if (!countryConfigs) return result;

    for (const config of countryConfigs) {
      if (config.condition(listing)) {
        result.push({
          title: this.interpolate(config.titleTemplate, listing),
          url: this.interpolate(config.urlTemplate, listing),
        });
      }
    }

    return result;
  }

  /**
   * Interpolate listing data into title and URL templates.
   */
  private interpolate(template: string, listing: Partial<Listing>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const val = (listing as any)[key];
      if (val === undefined || val === null || val === '') {
        return '';
      }
      return encodeURIComponent(String(val));
    });
  }
}

// Singleton for easy usage
export const supplementaryDataService = new SupplementaryDataService();
