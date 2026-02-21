import { findPortalByHost } from './portal-registry.js';
import type { SupportTier } from './portal-registry.js';

export type ScreeningVerdict =
  | 'allowed'
  | 'manual_only'
  | 'unknown_real_estate'
  | 'search_results'
  | 'not_real_estate'
  | 'invalid';

export interface ScreeningResult {
  verdict: ScreeningVerdict;
  hostname?: string;
  url?: URL;
  portalTier?: SupportTier;
}

/**
 * Path patterns that indicate search/listing index pages on known portals.
 * These are broad patterns that cover multiple portal conventions.
 */
const SEARCH_PAGE_PATTERNS: RegExp[] = [
  // Generic search/results paths (all portals)
  /\/(search|results|buscar|recherche|suche|ricerca)\b/i,
  /[?&](q|query|search|keyword)=/i,

  // UK & Ireland portals (rightmove, zoopla, onthemarket, daft.ie)
  // Match search index pages, not individual listings.
  // Negative lookaheads exclude:
  //   - zoopla detail pages: /for-sale/details/12345/
  //   - daft.ie listing pages: /for-sale/<description>/<numeric-id>
  /\/find\.(html|htm)/i,
  /\/for-sale\/(?!details\/)(?![^/]+\/\d+\b)/i,
  /\/to-rent\/(?!details\/)(?![^/]+\/\d+\b)/i,
  /\/house-prices/i,
  /\/property-for-sale\//i,
  /\/property-to-rent\//i,

  // Spanish portals (idealista, fotocasa, pisos)
  // Match listing index pages, not individual listings.
  // e.g. /venta-viviendas/madrid/ but NOT /comprar/vivienda/madrid/.../d
  /\/venta-viviendas\//i,
  /\/alquiler-viviendas\//i,
  /\/resultados-busqueda/i,
  /\/alquilar\//i,
  /\/en-venta\//i,

  // German portals (immobilienscout24)
  // e.g. /Suche/S-T/Wohnung-Mieten/Berlin/ but NOT /expose/12345
  /\/Suche\//i,
  /\/wohnung-mieten\//i,
  /\/wohnung-kaufen\//i,
  /\/haus-kaufen\//i,

  // French portals (seloger)
  // e.g. /annonces/achat/paris/ or /recherche/achat/paris/
  /\/annonces\//i,
  /\/recherche\//i,

  // Generic terminal path patterns (jitty /properties, funda /listings, etc.)
  // Only match when the path ENDS with /properties or /listing(s) — won't
  // match /properties/<id> or /listing/<id> since those have more path segments
  /\/listings?\/?$/i,
  /\/properties\/?$/i,
  /\/map-search/i,
];

/**
 * Non-real-estate domains — social media, video, search engines, news, email, etc.
 * We strip 'www.' before matching.
 */
const BLOCKED_HOSTS = new Set([
  // Search engines
  'google.com', 'google.co.uk', 'google.es', 'google.de', 'google.fr',
  'google.com.au', 'google.co.in', 'google.ca', 'google.ie',
  'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com',

  // Social media
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
  'reddit.com', 'tumblr.com', 'threads.net',

  // Video & streaming
  'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com',
  'netflix.com', 'hulu.com', 'disneyplus.com', 'spotify.com',

  // News & media
  'bbc.co.uk', 'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com',
  'reuters.com', 'bloomberg.com', 'washingtonpost.com', 'foxnews.com',

  // Email & messaging
  'gmail.com', 'mail.google.com', 'outlook.com', 'hotmail.com',
  'whatsapp.com', 'telegram.org', 'discord.com', 'slack.com',

  // E-commerce
  'amazon.com', 'amazon.co.uk', 'ebay.com', 'etsy.com', 'aliexpress.com',
  'walmart.com', 'target.com',

  // Dev & tools
  'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com',
  'medium.com', 'substack.com',

  // Misc popular sites
  'wikipedia.org', 'en.wikipedia.org', 'wikimedia.org',
  'apple.com', 'microsoft.com', 'adobe.com',
  'paypal.com', 'stripe.com',

  // Adult
  'pornhub.com', 'xvideos.com', 'xnxx.com',
]);

/**
 * Known real estate domains we don't have scrapers for yet.
 * Matching these gives a friendlier "we don't support this yet" message.
 */
const KNOWN_RE_DOMAINS = new Set([
  // US
  'homes.com', 'apartments.com',
  'compass.com', 'coldwellbanker.com', 'century21.com', 'kw.com',

  // UK
  'purplebricks.co.uk', 'primelocation.com', 'home.co.uk',

  // Europe
  'immowelt.de', 'immoweb.be', 'leboncoin.fr',
  'casa.it',
  'otodom.pl', 'sreality.cz', 'willhaben.at', 'finn.no',
  'boliga.dk', 'etuovi.com',

  // Asia-Pacific
  'propertyguru.com.sg', 'propertyguru.com.my',
  '99.co', 'magicbricks.com', 'housing.com', '99acres.com',

  // LATAM
  'mercadolibre.com', 'inmuebles24.com', 'properati.com',

  // Australia/NZ
  'realestate.co.nz', 'trademe.co.nz',

  // Middle East / Africa
  'bayut.com', 'propertyfinder.ae', 'property24.com',
]);

/** Strip www. prefix from a hostname */
function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/**
 * Screen a URL before it hits the extraction pipeline.
 * Pure function — no I/O, just string matching.
 */
export function screenUrl(rawUrl: string): ScreeningResult {
  if (!rawUrl || rawUrl.trim() === '') {
    return { verdict: 'invalid' };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { verdict: 'invalid' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { verdict: 'invalid', hostname: url.hostname, url };
  }

  const hostname = url.hostname;
  const bare = stripWww(hostname);

  // 1. Known portal with a scraper
  const portal = findPortalByHost(hostname);
  if (portal) {
    // Check if it looks like a search/listing index page
    const pathAndQuery = url.pathname + url.search;
    for (const pattern of SEARCH_PAGE_PATTERNS) {
      if (pattern.test(pathAndQuery)) {
        return { verdict: 'search_results', hostname, url, portalTier: portal.supportTier };
      }
    }
    if (portal.supportTier === 'manual-only') {
      return { verdict: 'manual_only', hostname, url, portalTier: portal.supportTier };
    }
    return { verdict: 'allowed', hostname, url, portalTier: portal.supportTier };
  }

  // 2. Blocked non-real-estate domains
  if (BLOCKED_HOSTS.has(bare) || BLOCKED_HOSTS.has(hostname)) {
    return { verdict: 'not_real_estate', hostname, url };
  }

  // 3. Known real estate domains without scrapers
  if (KNOWN_RE_DOMAINS.has(bare) || KNOWN_RE_DOMAINS.has(hostname)) {
    return { verdict: 'unknown_real_estate', hostname, url };
  }

  // 4. Default — give benefit of the doubt
  return { verdict: 'unknown_real_estate', hostname, url };
}
