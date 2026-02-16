import { InMemoryFirestoreClient, resetStore } from '../src/lib/firestore/in-memory-backend.js';
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
  { slug: 'mlslistings', scraper_name: 'mlslistings', host: 'www.mlslistings.com' },
  { slug: 'realtor', scraper_name: 'realtor', host: 'www.realtor.com' },
  { slug: 'idealista', scraper_name: 'idealista', host: 'www.idealista.com' },
  { slug: 'rightmove', scraper_name: 'rightmove', host: 'www.rightmove.co.uk' },
  { slug: 'laventa', scraper_name: 'pwb', host: 'www.laventa-mallorca.com' },
  { slug: 'zoopla', scraper_name: 'zoopla', host: 'www.zoopla.co.uk' },
  { slug: 'carusoimmobiliare', scraper_name: 'carusoimmobiliare', host: 'www.carusoimmobiliare.it' },
  { slug: 'wyomingmls', scraper_name: 'wyomingmls', host: 'www.wyomingmls.com' },
  { slug: 'forsalebyowner', scraper_name: 'forsalebyowner', host: 'www.forsalebyowner.com' },
  { slug: 'cerdfw', scraper_name: 'cerdfw', host: 'cerdfw.com' },
  { slug: 'realestateindia', scraper_name: 'realestateindia', host: 'www.realestateindia.com' },
  { slug: 'fotocasa', scraper_name: 'fotocasa', host: 'www.fotocasa.es' },
  { slug: 'pisos', scraper_name: 'pisos', host: 'www.pisos.com' },
];

beforeAll(async () => {
  for (const data of importHostsData) {
    const host = new ImportHost();
    host.assignAttributes(data);
    await host.save();
  }
});

afterEach(() => {
  // Clear listings between tests (keep import_hosts)
  const store = (inMemoryClient as any);
  // Only clear listings collection to preserve import_hosts
});

afterAll(() => {
  resetStore();
  clearCache();
});
