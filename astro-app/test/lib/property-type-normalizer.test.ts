import { describe, it, expect } from 'vitest';
import { normalizePropertyType } from '../../src/lib/extractor/property-type-normalizer.js';

describe('property-type-normalizer', () => {
  describe('normalizePropertyType', () => {
    it('returns "other" for null/undefined/empty', () => {
      expect(normalizePropertyType(null)).toBe('other');
      expect(normalizePropertyType(undefined)).toBe('other');
      expect(normalizePropertyType('')).toBe('other');
      expect(normalizePropertyType('  ')).toBe('other');
    });

    // English
    it('detects apartment (EN)', () => {
      expect(normalizePropertyType('Apartment')).toBe('apartment');
      expect(normalizePropertyType('2 bed flat in London')).toBe('apartment');
      expect(normalizePropertyType('Penthouse suite')).toBe('apartment');
      expect(normalizePropertyType('Duplex apartment')).toBe('apartment');
      expect(normalizePropertyType('Loft conversion')).toBe('apartment');
    });

    it('detects house (EN)', () => {
      expect(normalizePropertyType('House')).toBe('house');
      expect(normalizePropertyType('Detached house')).toBe('house');
      expect(normalizePropertyType('Semi-detached')).toBe('house');
      expect(normalizePropertyType('Terraced house')).toBe('house');
      expect(normalizePropertyType('Townhouse')).toBe('house');
      expect(normalizePropertyType('Bungalow')).toBe('house');
      expect(normalizePropertyType('Cottage')).toBe('house');
    });

    it('detects villa', () => {
      expect(normalizePropertyType('Villa')).toBe('villa');
      expect(normalizePropertyType('Luxury villa with pool')).toBe('villa');
      expect(normalizePropertyType('Chalet')).toBe('villa');
      expect(normalizePropertyType('Mansion')).toBe('villa');
    });

    it('detects studio', () => {
      expect(normalizePropertyType('Studio')).toBe('studio');
      expect(normalizePropertyType('Studio apartment')).toBe('studio');
    });

    it('detects land', () => {
      expect(normalizePropertyType('Land')).toBe('land');
      expect(normalizePropertyType('Building plot')).toBe('other'); // "plot" alone isn't matched
    });

    it('detects office', () => {
      expect(normalizePropertyType('Office')).toBe('office');
      expect(normalizePropertyType('Office space downtown')).toBe('office');
    });

    it('detects commercial', () => {
      expect(normalizePropertyType('Commercial property')).toBe('commercial');
      expect(normalizePropertyType('Shop for sale')).toBe('commercial');
      expect(normalizePropertyType('Retail unit')).toBe('commercial');
    });

    it('detects garage', () => {
      expect(normalizePropertyType('Garage')).toBe('garage');
      expect(normalizePropertyType('Parking space')).toBe('garage');
    });

    it('detects storage', () => {
      expect(normalizePropertyType('Storage unit')).toBe('storage');
    });

    // Spanish
    it('detects Spanish types', () => {
      expect(normalizePropertyType('Piso en venta')).toBe('apartment');
      expect(normalizePropertyType('Ático con terraza')).toBe('apartment');
      expect(normalizePropertyType('Casa adosada')).toBe('house');
      expect(normalizePropertyType('Chalet pareado')).toBe('villa');
      expect(normalizePropertyType('Terreno')).toBe('land');
      expect(normalizePropertyType('Solar urbano')).toBe('land');
      expect(normalizePropertyType('Local comercial')).toBe('commercial');
      expect(normalizePropertyType('Oficina')).toBe('office');
      expect(normalizePropertyType('Plaza de garaje')).toBe('garage');
      expect(normalizePropertyType('Trastero')).toBe('storage');
      expect(normalizePropertyType('Estudio')).toBe('studio');
    });

    // French
    it('detects French types', () => {
      expect(normalizePropertyType('Appartement')).toBe('apartment');
      expect(normalizePropertyType('Maison')).toBe('house');
      expect(normalizePropertyType('Terrain constructible')).toBe('land');
      expect(normalizePropertyType('Bureau')).toBe('office');
      expect(normalizePropertyType('Commerce')).toBe('commercial');
    });

    // German
    it('detects German types', () => {
      expect(normalizePropertyType('Wohnung')).toBe('apartment');
      expect(normalizePropertyType('Einfamilienhaus')).toBe('house');
      expect(normalizePropertyType('Reihenhaus')).toBe('house');
      expect(normalizePropertyType('Grundstück')).toBe('land');
      expect(normalizePropertyType('Büro')).toBe('office');
      expect(normalizePropertyType('Gewerbe')).toBe('commercial');
    });

    // Italian
    it('detects Italian types', () => {
      expect(normalizePropertyType('Appartamento')).toBe('apartment');
      expect(normalizePropertyType('Ufficio')).toBe('office');
      expect(normalizePropertyType('Box auto')).toBe('garage');
      expect(normalizePropertyType('Magazzino')).toBe('storage');
    });

    // Portuguese
    it('detects Portuguese types', () => {
      expect(normalizePropertyType('Apartamento')).toBe('apartment');
      expect(normalizePropertyType('Moradia')).toBe('house');
      expect(normalizePropertyType('Escritório')).toBe('office');
    });

    it('returns "other" for unrecognized text', () => {
      expect(normalizePropertyType('xyz123')).toBe('other');
      expect(normalizePropertyType('Something random')).toBe('other');
    });

    it('studio takes priority over apartment', () => {
      // "Studio" should match studio, not apartment (studio pattern is checked first)
      expect(normalizePropertyType('Studio')).toBe('studio');
    });
  });
});
