import { BaseModel, type AttributeDefinition } from '../firestore/base-model.js';

/**
 * Maps a website hostname to its scraper configuration.
 * Port of Ruby PropertyWebScraper::ImportHost.
 */
export class ImportHost extends BaseModel {
  static override _collectionName = 'import_hosts';
  static override _documentIdField = 'slug';
  static override _attributeDefinitions: Record<string, AttributeDefinition> = {
    scraper_name: { type: 'string' },
    host: { type: 'string' },
    slug: { type: 'string' },
    is_https: { type: 'boolean', default: false },
    details: { type: 'hash', default: {} },
    example_urls: { type: 'array', default: [] },
    invalid_urls: { type: 'array', default: [] },
    last_retrieval_at: { type: 'datetime' },
    valid_url_regex: { type: 'string' },
    pause_between_calls: { type: 'string', default: '5.seconds' },
    stale_age: { type: 'string', default: '1.day' },
  };

  scraper_name = '';
  host = '';
  slug = '';
  is_https = false;
  details: Record<string, unknown> = {};
  example_urls: string[] = [];
  invalid_urls: string[] = [];
  last_retrieval_at: Date | null = null;
  valid_url_regex = '';
  pause_between_calls = '5.seconds';
  stale_age = '1.day';

  get hostUrl(): string {
    return `http://${this.host}`;
  }

  /**
   * Returns stale age duration in milliseconds.
   * Port of Ruby ImportHost#stale_age_duration.
   */
  get staleAgeDurationMs(): number {
    const durationString = this.stale_age || '1.day';
    const parts = durationString.split('.');
    const count = parseInt(parts[0], 10) || 1;
    const unit = parts[1] || 'day';

    const multipliers: Record<string, number> = {
      second: 1000,
      seconds: 1000,
      minute: 60_000,
      minutes: 60_000,
      hour: 3_600_000,
      hours: 3_600_000,
      day: 86_400_000,
      days: 86_400_000,
      week: 604_800_000,
      weeks: 604_800_000,
    };

    return count * (multipliers[unit] || 86_400_000);
  }

  static async findByHost(hostname: string): Promise<ImportHost | null> {
    return ImportHost.findBy.call(ImportHost, { host: hostname }) as Promise<ImportHost | null>;
  }
}
