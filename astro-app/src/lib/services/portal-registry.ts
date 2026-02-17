import { allMappings } from '../extractor/mapping-loader.js';

export interface PortalConfig {
  scraperName: string;
  slug: string;
  hosts: string[];
  country: string;
  currency: string;
  localeCode: string;
  areaUnit: string;
  contentSource: 'html' | 'script-json' | 'json-ld' | 'flight-data';
  expectedExtractionRate?: number;
  stripTrailingSlash: boolean;
  requiresJsRendering: boolean;
}

/**
 * Hardcoded portal registry — serves as the primary source of truth.
 * Portals defined here take precedence over auto-discovered ones.
 */
export const PORTAL_REGISTRY: Record<string, PortalConfig> = {
  uk_rightmove: {
    scraperName: 'uk_rightmove',
    slug: 'uk_rightmove',
    hosts: ['www.rightmove.co.uk', 'rightmove.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'script-json',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  es_idealista: {
    scraperName: 'es_idealista',
    slug: 'es_idealista',
    hosts: ['www.idealista.com', 'idealista.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  uk_zoopla: {
    scraperName: 'uk_zoopla',
    slug: 'uk_zoopla',
    hosts: ['www.zoopla.co.uk', 'zoopla.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'script-json',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  us_realtor: {
    scraperName: 'us_realtor',
    slug: 'us_realtor',
    hosts: ['www.realtor.com', 'realtor.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'flight-data',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  es_fotocasa: {
    scraperName: 'es_fotocasa',
    slug: 'es_fotocasa',
    hosts: ['www.fotocasa.es', 'fotocasa.es'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  es_pisos: {
    scraperName: 'es_pisos',
    slug: 'es_pisos',
    hosts: ['www.pisos.com', 'pisos.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  in_realestateindia: {
    scraperName: 'in_realestateindia',
    slug: 'in_realestateindia',
    hosts: ['www.realestateindia.com', 'realestateindia.com'],
    country: 'IN',
    currency: 'INR',
    localeCode: 'en-IN',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  us_forsalebyowner: {
    scraperName: 'us_forsalebyowner',
    slug: 'us_forsalebyowner',
    hosts: ['www.forsalebyowner.com', 'forsalebyowner.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  uk_jitty: {
    scraperName: 'uk_jitty',
    slug: 'uk_jitty',
    hosts: ['jitty.com', 'www.jitty.com'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  uk_onthemarket: {
    scraperName: 'uk_onthemarket',
    slug: 'uk_onthemarket',
    hosts: ['www.onthemarket.com', 'onthemarket.com'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  ie_daft: {
    scraperName: 'ie_daft',
    slug: 'ie_daft',
    hosts: ['www.daft.ie', 'daft.ie'],
    country: 'IE',
    currency: 'EUR',
    localeCode: 'en-IE',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  pt_idealista: {
    scraperName: 'pt_idealista',
    slug: 'pt_idealista',
    hosts: ['www.idealista.pt', 'idealista.pt'],
    country: 'PT',
    currency: 'EUR',
    localeCode: 'pt',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
};

/**
 * Build additional portal configs from mapping metadata.
 * Mappings with a `portal` key get auto-registered.
 * Hardcoded entries in PORTAL_REGISTRY take precedence.
 */
function buildAutoDiscoveredPortals(): Record<string, PortalConfig> {
  const discovered: Record<string, PortalConfig> = {};
  try {
    const mappings = allMappings();
    for (const [name, mapping] of Object.entries(mappings)) {
      if (!mapping.portal) continue;
      // Skip if already in hardcoded registry
      if (PORTAL_REGISTRY[name]) continue;
      discovered[name] = {
        scraperName: name,
        slug: name,
        hosts: mapping.portal.hosts,
        country: mapping.portal.country,
        currency: mapping.portal.currency,
        localeCode: mapping.portal.localeCode,
        areaUnit: mapping.portal.areaUnit,
        contentSource: mapping.portal.contentSource || 'html',
        stripTrailingSlash: mapping.portal.stripTrailingSlash || false,
        requiresJsRendering: mapping.portal.requiresJsRendering || false,
      };
    }
  } catch {
    // Mapping bundle not available (e.g. during tests without Vite)
  }
  return discovered;
}

/** Merged registry: hardcoded + auto-discovered from mapping metadata. */
const mergedRegistry: Record<string, PortalConfig> = {
  ...buildAutoDiscoveredPortals(),
  ...PORTAL_REGISTRY, // hardcoded takes precedence
};

/** Reverse index: hostname -> PortalConfig */
const hostIndex = new Map<string, PortalConfig>();
for (const config of Object.values(mergedRegistry)) {
  for (const host of config.hosts) {
    hostIndex.set(host, config);
  }
}

export function findPortalByHost(hostname: string): PortalConfig | undefined {
  return hostIndex.get(hostname);
}

export function findPortalByName(name: string): PortalConfig | undefined {
  return mergedRegistry[name];
}

export function allPortalNames(): string[] {
  return Object.keys(mergedRegistry);
}
