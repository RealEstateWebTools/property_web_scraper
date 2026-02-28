import { deleteListing, getListing } from './src/lib/services/listing-store.js';
import { createHaul, addScrapeToHaul, getAllHauls, __clearStore } from './src/lib/services/haul-store.js';

async function main() {
  await __clearStore();
  const haul = await createHaul('test-haul-1', '127.0.0.1');
  await addScrapeToHaul('test-haul-1', { resultId: 'listing123', url: 'http://test.com', title: 'Test', grade: 'A', price: '100', extractionRate: 1, createdAt: new Date().toISOString() });
  
  const haulsBefore = await getAllHauls();
  console.log('Hauls before deletion:', haulsBefore[0].scrapes);

  await deleteListing('listing123');
  
  const haulsAfter = await getAllHauls();
  console.log('Hauls after deletion:', haulsAfter[0]?.scrapes);
}

main().catch(console.error);
