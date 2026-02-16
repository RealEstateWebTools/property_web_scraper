import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load an HTML fixture from test/fixtures/.
 * Reuses the same fixtures as the Vitest unit tests.
 */
export function loadFixture(name: string): string {
  const filePath = resolve(__dirname, '..', 'fixtures', `${name}.html`);
  return readFileSync(filePath, 'utf-8');
}
