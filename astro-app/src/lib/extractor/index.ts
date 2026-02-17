export { extractFromHtml } from './html-extractor.js';
export type { ExtractionResult, ExtractParams, ExtractionStatus } from './html-extractor.js';
export { findByName, clearCache } from './mapping-loader.js';
export type { ScraperMapping, FieldMapping, PortalMetadata } from './mapping-loader.js';
export { applyModifiers, parseModifierString, MODIFIER_REGISTRY } from './modifiers.js';
export { normalizeImageUrl, normalizeImageUrls } from './image-normalizer.js';
export { applyFilters } from './result-filter.js';
export type { ExtractionFilter, FilterResult } from './result-filter.js';
