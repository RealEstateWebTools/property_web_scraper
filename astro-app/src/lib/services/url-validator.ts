import { ImportHost } from '../models/import-host.js';
import { PORTAL_REGISTRY, findPortalByHost } from './portal-registry.js';

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
 * Derived from the portal registry for backward compatibility.
 */
export const LOCAL_HOST_MAP: Record<string, { scraper_name: string; slug: string }> = (() => {
  const map: Record<string, { scraper_name: string; slug: string }> = {};
  for (const config of Object.values(PORTAL_REGISTRY)) {
    for (const host of config.hosts) {
      map[host] = { scraper_name: config.scraperName, slug: config.slug };
    }
  }
  return map;
})();

/**
 * Build an in-memory ImportHost-like object from the local map.
 */
function buildLocalImportHost(hostname: string): ImportHost | null {
  const portal = findPortalByHost(hostname);
  if (!portal) return null;
  const host = new ImportHost();
  host.host = hostname;
  host.scraper_name = portal.scraperName;
  host.slug = portal.slug;
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
