import JSON5 from 'json5';
import type { ScraperMapping } from './mapping-loader.js';

// Import all mapping files as raw text (Vite ?raw suffix)
import pwbRaw from '../../../scraper_mappings/pwb.json?raw';
import idealistaRaw from '../../../scraper_mappings/idealista.json?raw';
import idealista2017Raw from '../../../scraper_mappings/idealista_2017.json?raw';
import mlslistingsRaw from '../../../scraper_mappings/mlslistings.json?raw';
import realtorRaw from '../../../scraper_mappings/realtor.json?raw';
import fotocasaRaw from '../../../scraper_mappings/fotocasa.json?raw';
import zooplaRaw from '../../../scraper_mappings/zoopla.json?raw';
import rightmoveRaw from '../../../scraper_mappings/rightmove.json?raw';
import wyomingmlsRaw from '../../../scraper_mappings/wyomingmls.json?raw';
import carusoimmobiliareRaw from '../../../scraper_mappings/carusoimmobiliare.json?raw';
import forsalebyownerRaw from '../../../scraper_mappings/forsalebyowner.json?raw';
import realestateindiaRaw from '../../../scraper_mappings/realestateindia.json?raw';
import cerdfwRaw from '../../../scraper_mappings/cerdfw.json?raw';
import pisosRaw from '../../../scraper_mappings/pisos.json?raw';
import inmo1Raw from '../../../scraper_mappings/inmo1.json?raw';
import weebrixRaw from '../../../scraper_mappings/weebrix.json?raw';
import ukJittyRaw from '../../../scraper_mappings/uk_jitty.json?raw';

function parse(raw: string): ScraperMapping {
  const parsed = JSON5.parse(raw);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

const mappings: Record<string, ScraperMapping> = {
  pwb: parse(pwbRaw),
  idealista: parse(idealistaRaw),
  idealista_2017: parse(idealista2017Raw),
  mlslistings: parse(mlslistingsRaw),
  realtor: parse(realtorRaw),
  fotocasa: parse(fotocasaRaw),
  zoopla: parse(zooplaRaw),
  rightmove: parse(rightmoveRaw),
  wyomingmls: parse(wyomingmlsRaw),
  carusoimmobiliare: parse(carusoimmobiliareRaw),
  forsalebyowner: parse(forsalebyownerRaw),
  realestateindia: parse(realestateindiaRaw),
  cerdfw: parse(cerdfwRaw),
  pisos: parse(pisosRaw),
  inmo1: parse(inmo1Raw),
  weebrix: parse(weebrixRaw),
  uk_jitty: parse(ukJittyRaw),
};

export default mappings;
