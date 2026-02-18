/**
 * Normalizes raw portal-specific property type text to PWB's standardized enum.
 * Supports terms in EN, ES, FR, DE, IT, PT.
 */

export type PropTypeKey =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'studio'
  | 'land'
  | 'commercial'
  | 'office'
  | 'garage'
  | 'storage'
  | 'other';

interface TypePattern {
  key: PropTypeKey;
  pattern: RegExp;
}

/**
 * Strip diacritics so that word-boundary matching works reliably.
 * e.g. "Ático" → "Atico", "büro" → "buro"
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TYPE_PATTERNS: TypePattern[] = [
  {
    key: 'studio',
    pattern: /\b(studio|estudio|monolocale|einzimmerwohnung|kitnet|t0)\b/i,
  },
  {
    key: 'apartment',
    pattern: /\b(apartment|flat|piso|apartamento|appartement|appartamento|wohnung|duplex|penthouse|atico|loft)\b/i,
  },
  {
    key: 'villa',
    pattern: /\b(villa|chalet|manor|mansion|mansion)\b/i,
  },
  {
    key: 'house',
    pattern: /\b(house|casa|maison|haus|townhouse|bungalow|cottage|detached|semi-detached|terraced|adosado|pareado|unifamiliar|vivienda|moradia|reihenhaus|einfamilienhaus)\b/i,
  },
  {
    key: 'land',
    pattern: /\b(land|terrain|terreno|solar|grundstuck|parcela)\b/i,
  },
  {
    key: 'office',
    pattern: /\b(office|oficina|bureau|buro|ufficio|escritorio)\b/i,
  },
  {
    key: 'commercial',
    pattern: /\b(commercial|local\s*comercial|commerce|gewerbe|commerciale|shop|retail|negocio|nave)\b/i,
  },
  {
    key: 'garage',
    pattern: /\b(garage|garaje|parking|plaza\s*de\s*garaje|stellplatz|box\s*auto)\b/i,
  },
  {
    key: 'storage',
    pattern: /\b(storage|trastero|cellier|lager|magazzino|armazem)\b/i,
  },
];

/**
 * Maps a raw property type string (or title) to a standardized PWB prop_type_key.
 * Falls back to 'other' if no pattern matches.
 */
export function normalizePropertyType(rawType: string | undefined | null): PropTypeKey {
  if (!rawType) return 'other';

  const text = rawType.trim();
  if (!text) return 'other';

  // Strip diacritics so \b word boundaries work for accented terms
  const normalized = stripDiacritics(text);

  for (const { key, pattern } of TYPE_PATTERNS) {
    if (pattern.test(normalized)) return key;
  }

  return 'other';
}
