import type { Listing } from '../models/listing.js';
import defaultLinksConfig from '../../config/supplementary-links.json';

export interface SupplementaryLinkConfig {
  titleTemplate: string;
  urlTemplate: string;
  requireFields?: string[];
  category?: string;
  icon?: string;
}

export type CountryLinkConfig = Record<string, SupplementaryLinkConfig[]>;

export interface GeneratedLink {
  title: string;
  url: string;
  category?: string;
  icon?: string;
}

export class SupplementaryDataService {
  private configs: CountryLinkConfig;

  constructor(customConfigs?: CountryLinkConfig) {
    this.configs = customConfigs || (defaultLinksConfig as CountryLinkConfig);
  }

  /**
   * Calculates which lists to generate for which property and
   * constructs the formatted links based on configured templates.
   */
  generateLinks(listing: Partial<Listing>): GeneratedLink[] {
    const country = (listing.country || '').trim().toUpperCase();
    const result: GeneratedLink[] = [];

    // Fallback if country is not set but we have region or want generic lists
    const countryConfigs = this.configs[country];
    if (!countryConfigs) return result;

    for (const config of countryConfigs) {
      let conditionsMet = true;
      if (config.requireFields && config.requireFields.length > 0) {
        conditionsMet = config.requireFields.every((field) => {
          const val = (listing as any)[field];
          return val !== undefined && val !== null && val !== '';
        });
      }

      if (conditionsMet) {
        result.push({
          title: this.interpolate(config.titleTemplate, listing),
          url: this.interpolate(config.urlTemplate, listing),
          ...(config.category ? { category: config.category } : {}),
          ...(config.icon ? { icon: config.icon } : {}),
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
