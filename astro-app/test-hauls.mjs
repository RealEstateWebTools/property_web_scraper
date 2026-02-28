import { getAllHauls } from './src/lib/services/haul-store.js';
const hauls = await getAllHauls();
console.log(JSON.stringify(hauls.map(h => h.scrapes[0]), null, 2));
