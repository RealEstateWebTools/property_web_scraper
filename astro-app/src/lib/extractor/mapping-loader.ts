import JSON5 from 'json5';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface FieldMapping {
  cssLocator?: string;
  xpath?: string;
  scriptRegEx?: string;
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
}

const mappingCache = new Map<string, ScraperMapping>();

function getMappingsDir(): string {
  // Resolve from project root (astro-app/)
  const thisFile = typeof __filename !== 'undefined'
    ? __filename
    : fileURLToPath(import.meta.url);
  const projectRoot = resolve(dirname(thisFile), '..', '..', '..');
  return resolve(projectRoot, 'scraper_mappings');
}

export function findByName(name: string): ScraperMapping | null {
  if (mappingCache.has(name)) {
    return mappingCache.get(name)!;
  }
  const mappingsDir = getMappingsDir();
  const filePath = resolve(mappingsDir, `${name}.json`);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON5.parse(raw);
    // JSON files wrap in an array: [{ name: ..., ... }]
    const mapping: ScraperMapping = Array.isArray(parsed) ? parsed[0] : parsed;
    mappingCache.set(name, mapping);
    return mapping;
  } catch {
    return null;
  }
}

export function clearCache(): void {
  mappingCache.clear();
}

const KNOWN_MAPPINGS = [
  'pwb', 'mlslistings', 'realtor', 'fotocasa',
  'idealista', 'zoopla', 'rightmove', 'wyomingmls', 'carusoimmobiliare',
  'forsalebyowner', 'realestateindia', 'cerdfw', 'pisos', 'inmo1',
];

export function allMappingNames(): string[] {
  return [...KNOWN_MAPPINGS];
}
