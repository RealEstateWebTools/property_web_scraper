import { ImportHost } from '../models/import-host.js';

export interface ValidationResult {
  valid: boolean;
  uri?: URL;
  importHost?: ImportHost;
  errorMessage?: string;
  errorCode?: string;
}

export const MISSING = 'missing';
export const INVALID = 'invalid';
export const UNSUPPORTED = 'unsupported';

/**
 * Local fallback mapping: hostname → scraper name + slug.
 * Used when Firestore is unavailable.
 */
export const LOCAL_HOST_MAP: Record<string, { scraper_name: string; slug: string }> = {
  'www.idealista.com': { scraper_name: 'idealista', slug: 'idealista' },
  'idealista.com': { scraper_name: 'idealista', slug: 'idealista' },
  'www.rightmove.co.uk': { scraper_name: 'rightmove', slug: 'rightmove' },
  'rightmove.co.uk': { scraper_name: 'rightmove', slug: 'rightmove' },
  'www.zoopla.co.uk': { scraper_name: 'zoopla', slug: 'zoopla' },
  'zoopla.co.uk': { scraper_name: 'zoopla', slug: 'zoopla' },
  'www.realtor.com': { scraper_name: 'realtor', slug: 'realtor' },
  'realtor.com': { scraper_name: 'realtor', slug: 'realtor' },
  'www.fotocasa.es': { scraper_name: 'fotocasa', slug: 'fotocasa' },
  'fotocasa.es': { scraper_name: 'fotocasa', slug: 'fotocasa' },
  'www.pisos.com': { scraper_name: 'pisos', slug: 'pisos' },
  'pisos.com': { scraper_name: 'pisos', slug: 'pisos' },
  'www.realestateindia.com': { scraper_name: 'realestateindia', slug: 'realestateindia' },
  'realestateindia.com': { scraper_name: 'realestateindia', slug: 'realestateindia' },
  'www.forsalebyowner.com': { scraper_name: 'forsalebyowner', slug: 'forsalebyowner' },
  'forsalebyowner.com': { scraper_name: 'forsalebyowner', slug: 'forsalebyowner' },
  'jitty.com': { scraper_name: 'uk_jitty', slug: 'uk_jitty' },
  'www.jitty.com': { scraper_name: 'uk_jitty', slug: 'uk_jitty' },
};

/**
 * Build an in-memory ImportHost-like object from the local map.
 */
function buildLocalImportHost(hostname: string): ImportHost | null {
  const entry = LOCAL_HOST_MAP[hostname];
  if (!entry) return null;
  const host = new ImportHost();
  host.host = hostname;
  host.scraper_name = entry.scraper_name;
  host.slug = entry.slug;
  return host;
}

/**
 * Validate and parse a URL for use with the scraper.
 * Port of Ruby UrlValidator.call.
 * Falls back to local host map when Firestore is unavailable.
 */
export async function validateUrl(url: string | undefined | null): Promise<ValidationResult> {
  if (!url || url.trim() === '') {
    return { valid: false, errorCode: MISSING, errorMessage: 'Please provide a url' };
  }

  const stripped = url.trim();
  let uri: URL;
  try {
    uri = new URL(stripped);
  } catch {
    return { valid: false, errorCode: INVALID, errorMessage: 'Please provide a valid url' };
  }

  if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
    return { valid: false, errorCode: INVALID, errorMessage: 'Please provide a valid url' };
  }

  // Try Firestore first, fall back to local map
  let importHost: ImportHost | null = null;
  try {
    importHost = await ImportHost.findByHost(uri.hostname);
  } catch {
    // Firestore unavailable — use local fallback
  }

  if (!importHost) {
    importHost = buildLocalImportHost(uri.hostname);
  }

  if (!importHost) {
    return {
      valid: false,
      errorCode: UNSUPPORTED,
      errorMessage: 'Sorry, the url provided is currently not supported',
    };
  }

  return { valid: true, uri, importHost };
}
