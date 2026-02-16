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

export const PORTAL_REGISTRY: Record<string, PortalConfig> = {
  rightmove: {
    scraperName: 'rightmove',
    slug: 'rightmove',
    hosts: ['www.rightmove.co.uk', 'rightmove.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'script-json',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  idealista: {
    scraperName: 'idealista',
    slug: 'idealista',
    hosts: ['www.idealista.com', 'idealista.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  zoopla: {
    scraperName: 'zoopla_v2',
    slug: 'zoopla_v2',
    hosts: ['www.zoopla.co.uk', 'zoopla.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'script-json',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  realtor: {
    scraperName: 'realtor',
    slug: 'realtor',
    hosts: ['www.realtor.com', 'realtor.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en-US',
    areaUnit: 'sqft',
    contentSource: 'flight-data',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  fotocasa: {
    scraperName: 'fotocasa',
    slug: 'fotocasa',
    hosts: ['www.fotocasa.es', 'fotocasa.es'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  pisos: {
    scraperName: 'pisos',
    slug: 'pisos',
    hosts: ['www.pisos.com', 'pisos.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es-ES',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  realestateindia: {
    scraperName: 'realestateindia',
    slug: 'realestateindia',
    hosts: ['www.realestateindia.com', 'realestateindia.com'],
    country: 'IN',
    currency: 'INR',
    localeCode: 'en-IN',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  forsalebyowner: {
    scraperName: 'forsalebyowner',
    slug: 'forsalebyowner',
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
  onthemarket: {
    scraperName: 'onthemarket',
    slug: 'onthemarket',
    hosts: ['www.onthemarket.com', 'onthemarket.com'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en-GB',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
  daft: {
    scraperName: 'daft',
    slug: 'daft',
    hosts: ['www.daft.ie', 'daft.ie'],
    country: 'IE',
    currency: 'EUR',
    localeCode: 'en-IE',
    areaUnit: 'sqmt',
    contentSource: 'html',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },
};

/** Reverse index: hostname → PortalConfig */
const hostIndex = new Map<string, PortalConfig>();
for (const config of Object.values(PORTAL_REGISTRY)) {
  for (const host of config.hosts) {
    hostIndex.set(host, config);
  }
}

export function findPortalByHost(hostname: string): PortalConfig | undefined {
  return hostIndex.get(hostname);
}

export function findPortalByName(name: string): PortalConfig | undefined {
  return PORTAL_REGISTRY[name];
}

export function allPortalNames(): string[] {
  return Object.keys(PORTAL_REGISTRY);
}
