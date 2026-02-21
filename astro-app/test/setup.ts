import { InMemoryFirestoreClient, resetStore, clearCollections } from '../src/lib/firestore/in-memory-backend.js';
import { setClient } from '../src/lib/firestore/client.js';
import { clearCache } from '../src/lib/extractor/mapping-loader.js';
import { ImportHost } from '../src/lib/models/import-host.js';

// Inject in-memory Firestore for all tests
const inMemoryClient = new InMemoryFirestoreClient();
setClient(inMemoryClient);

// Set test environment
process.env.FIRESTORE_PROJECT_ID = 'test-project';
process.env.FIRESTORE_COLLECTION_PREFIX = '';

// Seed import hosts before all tests
const importHostsData = [
  { slug: 'us_mlslistings', scraper_name: 'us_mlslistings', host: 'www.mlslistings.com' },
  { slug: 'us_realtor', scraper_name: 'us_realtor', host: 'www.realtor.com' },
  { slug: 'es_idealista', scraper_name: 'es_idealista', host: 'www.idealista.com' },
  { slug: 'uk_rightmove', scraper_name: 'uk_rightmove', host: 'www.rightmove.co.uk' },
  { slug: 'uk_zoopla', scraper_name: 'uk_zoopla', host: 'www.zoopla.co.uk' },

  { slug: 'us_wyomingmls', scraper_name: 'us_wyomingmls', host: 'www.wyomingmls.com' },
  { slug: 'us_forsalebyowner', scraper_name: 'us_forsalebyowner', host: 'www.forsalebyowner.com' },

  { slug: 'in_realestateindia', scraper_name: 'in_realestateindia', host: 'www.realestateindia.com' },
  { slug: 'es_fotocasa', scraper_name: 'es_fotocasa', host: 'www.fotocasa.es' },
  { slug: 'es_pisos', scraper_name: 'es_pisos', host: 'www.pisos.com' },
];

beforeAll(async () => {
  for (const data of importHostsData) {
    const host = new ImportHost();
    host.assignAttributes(data);
    await host.save();
  }
});

afterEach(() => {
  // Clear listings/diagnostics between tests while preserving import_hosts
  clearCollections('listings', 'diagnostics');
});

afterAll(() => {
  resetStore();
  clearCache();
});
