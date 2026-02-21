import { allMappings } from '../extractor/mapping-loader.js';

export type SupportTier = 'core' | 'experimental' | 'manual-only';

export interface PortalConfig {
  scraperName: string;
  slug: string;
  hosts: string[];
  country: string;
  currency: string;
  localeCode: string;
  areaUnit: string;
  contentSource: 'html' | 'script-json' | 'json-ld' | 'flight-data';
  supportTier: SupportTier;
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
    supportTier: 'core',
    expectedExtractionRate: 0.85,
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
    supportTier: 'manual-only',
    expectedExtractionRate: 0.75,
    stripTrailingSlash: false,
    requiresJsRendering: true,
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
    supportTier: 'core',
    expectedExtractionRate: 0.85,
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
    supportTier: 'core',
    expectedExtractionRate: 0.85,
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
    supportTier: 'core',
    expectedExtractionRate: 0.70,
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
    supportTier: 'core',
    expectedExtractionRate: 0.45,
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
    supportTier: 'core',
    expectedExtractionRate: 0.55,
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
    supportTier: 'core',
    expectedExtractionRate: 0.95,
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
    supportTier: 'core',
    expectedExtractionRate: 0.85,
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
    supportTier: 'core',
    expectedExtractionRate: 0.70,
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
    supportTier: 'core',
    expectedExtractionRate: 0.85,
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
    supportTier: 'manual-only',
    expectedExtractionRate: 0.90,
    stripTrailingSlash: false,
    requiresJsRendering: true,
  },
  de_immoscout: {
    scraperName: 'de_immoscout',
    slug: 'de_immoscout',
    hosts: ['www.immobilienscout24.de', 'immobilienscout24.de'],
    country: 'DE',
    currency: 'EUR',
    localeCode: 'de-DE',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  au_domain: {
    scraperName: 'au_domain',
    slug: 'au_domain',
    hosts: ['www.domain.com.au', 'domain.com.au'],
    country: 'AU',
    currency: 'AUD',
    localeCode: 'en-AU',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  au_realestate: {
    scraperName: 'au_realestate',
    slug: 'au_realestate',
    hosts: ['www.realestate.com.au', 'realestate.com.au'],
    country: 'AU',
    currency: 'AUD',
    localeCode: 'en-AU',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  us_redfin: {
    scraperName: 'us_redfin',
    slug: 'us_redfin',
    hosts: ['www.redfin.com', 'redfin.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'html',
    supportTier: 'core',
    expectedExtractionRate: 0.75,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  us_zillow: {
    scraperName: 'us_zillow',
    slug: 'us_zillow',
    hosts: ['www.zillow.com', 'zillow.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'html',
    supportTier: 'experimental',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  us_trulia: {
    scraperName: 'us_trulia',
    slug: 'us_trulia',
    hosts: ['www.trulia.com', 'trulia.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.75,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  nl_funda: {
    scraperName: 'nl_funda',
    slug: 'nl_funda',
    hosts: ['www.funda.nl', 'funda.nl'],
    country: 'NL',
    currency: 'EUR',
    localeCode: 'nl-NL',
    areaUnit: 'sqmt',
    contentSource: 'html',
    supportTier: 'core',
    expectedExtractionRate: 0.70,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  se_hemnet: {
    scraperName: 'generic_real_estate',
    slug: 'se_hemnet',
    hosts: ['www.hemnet.se', 'hemnet.se'],
    country: 'SE',
    currency: 'SEK',
    localeCode: 'sv-SE',
    areaUnit: 'sqmt',
    contentSource: 'json-ld',
    supportTier: 'experimental',
    expectedExtractionRate: 0.30,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  fr_seloger: {
    scraperName: 'fr_seloger',
    slug: 'fr_seloger',
    hosts: ['www.seloger.com', 'seloger.com'],
    country: 'FR',
    currency: 'EUR',
    localeCode: 'fr-FR',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.60,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  it_immobiliare: {
    scraperName: 'it_immobiliare',
    slug: 'it_immobiliare',
    hosts: ['www.immobiliare.it', 'immobiliare.it'],
    country: 'IT',
    currency: 'EUR',
    localeCode: 'it-IT',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  za_property24: {
    scraperName: 'za_property24',
    slug: 'za_property24',
    hosts: ['www.property24.com', 'property24.com'],
    country: 'ZA',
    currency: 'ZAR',
    localeCode: 'en-ZA',
    areaUnit: 'sqmt',
    contentSource: 'json-ld',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  be_immoweb: {
    scraperName: 'be_immoweb',
    slug: 'be_immoweb',
    hosts: ['www.immoweb.be', 'immoweb.be'],
    country: 'BE',
    currency: 'EUR',
    localeCode: 'en-BE',
    areaUnit: 'sqmt',
    contentSource: 'script-json',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  ae_bayut: {
    scraperName: 'ae_bayut',
    slug: 'ae_bayut',
    hosts: ['www.bayut.com', 'bayut.com'],
    country: 'AE',
    currency: 'AED',
    localeCode: 'en-AE',
    areaUnit: 'sqft',
    contentSource: 'json-ld',
    supportTier: 'core',
    expectedExtractionRate: 0.80,
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
        supportTier: 'experimental',
        ...(mapping.expectedExtractionRate != null
          ? { expectedExtractionRate: mapping.expectedExtractionRate }
          : {}),
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
