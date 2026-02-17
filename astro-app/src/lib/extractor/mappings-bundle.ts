import JSON5 from 'json5';
import type { ScraperMapping } from './mapping-loader.js';

// Auto-discover all mapping files via Vite glob import.
// Adding a new scraper only requires dropping a JSON file into config/scraper_mappings/.
const rawModules: Record<string, string> = import.meta.glob(
  '../../../../config/scraper_mappings/*.json',
  { eager: true, query: '?raw', import: 'default' },
);

function parse(raw: string): ScraperMapping {
  const parsed = JSON5.parse(raw);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

const mappings: Record<string, ScraperMapping> = {};
for (const [path, raw] of Object.entries(rawModules)) {
  const filename = path.split('/').pop();
  if (!filename) continue;
  const name = filename.replace('.json', '');
  mappings[name] = parse(raw);
}

export default mappings;
