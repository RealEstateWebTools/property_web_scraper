import type { Listing } from '../models/listing.js';
import defaultLinksConfig from '../../config/supplementary-links.json';

export interface SupplementaryLinkConfig {
  id?: string;
  titleTemplate: string;
  descriptionTemplate?: string;
  urlTemplate: string;
  requireFields?: string[];
  requireAnyFields?: string[];
  excludeIfFields?: string[];
  category?: string;
  icon?: string;
  intent?: string;
  geoLevel?: string;
  sourceName?: string;
  sourceType?: 'official' | 'commercial' | 'community';
  access?: 'free' | 'freemium' | 'paid' | 'api_key_required';
  freshness?: 'real_time' | 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
  priority?: number;
}

export type CountryLinkConfig = Record<string, SupplementaryLinkConfig[]>;

export interface GeneratedLink {
  id?: string;
  title: string;
  description?: string;
  url: string;
  category?: string;
  icon?: string;
  intent?: string;
  geoLevel?: string;
  sourceName?: string;
  sourceType?: 'official' | 'commercial' | 'community';
  access?: 'free' | 'freemium' | 'paid' | 'api_key_required';
  freshness?: 'real_time' | 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
  priority?: number;
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

    const countryConfigs = this.configs[country] || [];
    const defaultConfigs = this.configs.DEFAULT || [];
    const activeConfigs = [...defaultConfigs, ...countryConfigs];

    if (activeConfigs.length === 0) return result;

    for (const config of activeConfigs) {
      let conditionsMet = true;

      if (config.requireFields && config.requireFields.length > 0) {
        conditionsMet = config.requireFields.every((field) => {
          const val = (listing as any)[field];
          return val !== undefined && val !== null && val !== '';
        });
      }

      if (conditionsMet && config.requireAnyFields && config.requireAnyFields.length > 0) {
        conditionsMet = config.requireAnyFields.some((field) => {
          const val = (listing as any)[field];
          return val !== undefined && val !== null && val !== '';
        });
      }

      if (conditionsMet && config.excludeIfFields && config.excludeIfFields.length > 0) {
        conditionsMet = !config.excludeIfFields.some((field) => {
          const val = (listing as any)[field];
          return val !== undefined && val !== null && val !== '';
        });
      }

      if (conditionsMet) {
        const url = this.interpolate(config.urlTemplate, listing);
        if (!this.isValidHttpUrl(url)) continue;

        result.push({
          ...(config.id ? { id: config.id } : {}),
          title: this.interpolate(config.titleTemplate, listing),
          ...(config.descriptionTemplate
            ? { description: this.interpolate(config.descriptionTemplate, listing) }
            : {}),
          url,
          ...(config.category ? { category: config.category } : {}),
          ...(config.icon ? { icon: config.icon } : {}),
          ...(config.intent ? { intent: config.intent } : {}),
          ...(config.geoLevel ? { geoLevel: config.geoLevel } : {}),
          ...(config.sourceName ? { sourceName: config.sourceName } : {}),
          ...(config.sourceType ? { sourceType: config.sourceType } : {}),
          ...(config.access ? { access: config.access } : {}),
          ...(config.freshness ? { freshness: config.freshness } : {}),
          ...(typeof config.priority === 'number' ? { priority: config.priority } : {}),
        });
      }
    }

    const deduped = this.dedupeLinks(result);
    deduped.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    return deduped;
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

  private dedupeLinks(links: GeneratedLink[]): GeneratedLink[] {
    const seen = new Set<string>();
    const out: GeneratedLink[] = [];

    for (const link of links) {
      const dedupeKey = link.id || link.url;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(link);
    }

    return out;
  }

  private isValidHttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

// Singleton for easy usage
export const supplementaryDataService = new SupplementaryDataService();
