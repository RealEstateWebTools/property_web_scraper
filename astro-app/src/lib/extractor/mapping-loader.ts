import mappings from './mappings-bundle.js';

export interface ThumbnailPattern {
  match: string;
  replace: string;
}

export interface FieldMapping {
  cssLocator?: string;
  xpath?: string;
  scriptRegEx?: string;
  flightDataPath?: string;
  scriptJsonPath?: string;
  scriptJsonVar?: string;
  jsonLdPath?: string;
  jsonLdType?: string;
  urlPathPart?: string;
  cssAttr?: string;
  xmlAttr?: string;
  cssCountId?: string;
  splitTextCharacter?: string;
  splitTextArrayId?: string;
  stripString?: string;
  stripPunct?: string;
  stripFirstChar?: string;
  imagePathPrefix?: string;
  value?: string;
  evaluator?: string;
  evaluatorParam?: string;
  caseInsensitive?: boolean;
  fallbacks?: FieldMapping[];
  modifiers?: string[];
  thumbnailPatterns?: ThumbnailPattern[];
  apiEndpoint?: string;
  apiJsonPath?: string;
}

export interface PortalMetadata {
  hosts: string[];
  country: string;
  currency: string;
  localeCode: string;
  areaUnit: string;
  contentSource?: 'html' | 'script-json' | 'json-ld' | 'flight-data';
  stripTrailingSlash?: boolean;
  requiresJsRendering?: boolean;
}

export interface ScraperMapping {
  name: string;
  defaultValues?: Record<string, FieldMapping>;
  textFields?: Record<string, FieldMapping>;
  intFields?: Record<string, FieldMapping>;
  floatFields?: Record<string, FieldMapping>;
  booleanFields?: Record<string, FieldMapping>;
  images?: FieldMapping[];
  features?: FieldMapping[];
  extraFields?: Record<string, FieldMapping>;
  expectedExtractionRate?: number;
  portal?: PortalMetadata;
}

const mappingCache = new Map<string, ScraperMapping>();

export function findByName(name: string): ScraperMapping | null {
  if (mappingCache.has(name)) {
    return mappingCache.get(name)!;
  }
  const mapping = mappings[name];
  if (!mapping) {
    return null;
  }
  mappingCache.set(name, mapping);
  return mapping;
}

export function clearCache(): void {
  mappingCache.clear();
}

export function allMappingNames(): string[] {
  return Object.keys(mappings);
}

export function getCacheStats(): { size: number; names: string[] } {
  return { size: mappingCache.size, names: Array.from(mappingCache.keys()) };
}

/**
 * Return all mappings keyed by name.
 * Used by portal-registry to auto-discover portals from mapping metadata.
 */
export function allMappings(): Record<string, ScraperMapping> {
  return mappings;
}
