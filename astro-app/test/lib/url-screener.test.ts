import { describe, it, expect } from 'vitest';
import { screenUrl } from '../../src/lib/services/url-screener.js';

describe('url-screener', () => {
  describe('allowed — known portal single-listing URLs', () => {
    it('allows rightmove property page', () => {
      const r = screenUrl('https://www.rightmove.co.uk/properties/168908774');
      expect(r.verdict).toBe('allowed');
      expect(r.hostname).toBe('www.rightmove.co.uk');
    });

    it('returns manual_only for idealista property page (JS rendering required)', () => {
      const r = screenUrl('https://www.idealista.com/inmueble/12345678/');
      expect(r.verdict).toBe('manual_only');
    });

    it('allows zoopla property page', () => {
      const r = screenUrl('https://www.zoopla.co.uk/for-sale/details/12345678/');
      expect(r.verdict).toBe('allowed');
    });

    it('allows realtor.com property page', () => {
      const r = screenUrl('https://www.realtor.com/realestateandhomes-detail/123-Main-St_City_ST_12345_M12345-67890');
      expect(r.verdict).toBe('allowed');
    });

    it('allows fotocasa property page', () => {
      const r = screenUrl('https://www.fotocasa.es/es/comprar/vivienda/madrid/calefaccion/12345678/d');
      expect(r.verdict).toBe('allowed');
    });
  });

  describe('search_results — search/listing pages on known portals', () => {
    it('detects rightmove house-prices page', () => {
      const r = screenUrl('https://www.rightmove.co.uk/house-prices.html');
      expect(r.verdict).toBe('search_results');
    });

    it('detects rightmove for-sale search', () => {
      const r = screenUrl('https://www.rightmove.co.uk/property-for-sale/London.html');
      expect(r.verdict).toBe('search_results');
    });

    it('detects rightmove to-rent search', () => {
      const r = screenUrl('https://www.rightmove.co.uk/property-to-rent/find.html?searchLocation=London');
      expect(r.verdict).toBe('search_results');
    });

    it('detects idealista search results', () => {
      const r = screenUrl('https://www.idealista.com/venta-viviendas/madrid-madrid/');
      expect(r.verdict).toBe('search_results');
    });

    it('detects idealista alquiler search', () => {
      const r = screenUrl('https://www.idealista.com/alquiler-viviendas/barcelona/');
      expect(r.verdict).toBe('search_results');
    });

    it('detects generic search query param', () => {
      const r = screenUrl('https://www.rightmove.co.uk/find.html?searchLocation=SW1');
      expect(r.verdict).toBe('search_results');
    });

    it('detects map-search pages', () => {
      const r = screenUrl('https://www.zoopla.co.uk/for-sale/map-search/');
      expect(r.verdict).toBe('search_results');
    });
  });

  describe('not_real_estate — blocked mainstream sites', () => {
    it('blocks YouTube', () => {
      const r = screenUrl('https://www.youtube.com/watch?v=abc123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Google', () => {
      const r = screenUrl('https://www.google.com/search?q=houses');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Facebook', () => {
      const r = screenUrl('https://www.facebook.com/marketplace/item/123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Twitter/X', () => {
      const r = screenUrl('https://twitter.com/someone/status/123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks x.com', () => {
      const r = screenUrl('https://x.com/someone/status/123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Reddit', () => {
      const r = screenUrl('https://www.reddit.com/r/realestate/comments/abc');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks TikTok', () => {
      const r = screenUrl('https://www.tiktok.com/@user/video/123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Amazon', () => {
      const r = screenUrl('https://www.amazon.com/dp/B001234');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks Wikipedia', () => {
      const r = screenUrl('https://en.wikipedia.org/wiki/Real_estate');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks adult sites', () => {
      const r = screenUrl('https://www.pornhub.com/view_video?id=123');
      expect(r.verdict).toBe('not_real_estate');
    });

    it('blocks without www prefix', () => {
      const r = screenUrl('https://youtube.com/watch?v=abc');
      expect(r.verdict).toBe('not_real_estate');
    });
  });

  describe('unknown_real_estate — known RE sites without scrapers', () => {
    it('identifies Zillow', () => {
      const r = screenUrl('https://www.zillow.com/homedetails/123-Main-St/12345_zpid/');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies Redfin', () => {
      const r = screenUrl('https://www.redfin.com/CA/San-Francisco/123-Main-St/home/12345');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies Trulia', () => {
      const r = screenUrl('https://www.trulia.com/home/123-main-st-city-st-12345');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies immowelt.de', () => {
      const r = screenUrl('https://www.immowelt.de/expose/12345');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies seloger.com', () => {
      const r = screenUrl('https://www.seloger.com/annonces/achat/appartement/paris/12345.htm');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies funda.nl', () => {
      const r = screenUrl('https://www.funda.nl/koop/amsterdam/huis-12345/');
      expect(r.verdict).toBe('unknown_real_estate');
    });

    it('identifies hemnet.se', () => {
      const r = screenUrl('https://www.hemnet.se/bostad/lagenhet-2rum-stockholm-12345');
      expect(r.verdict).toBe('unknown_real_estate');
    });
  });

  describe('unknown_real_estate — unknown domains (benefit of the doubt)', () => {
    it('defaults to unknown_real_estate for unfamiliar domains', () => {
      const r = screenUrl('https://www.somenichepropertysite.com/listing/42');
      expect(r.verdict).toBe('unknown_real_estate');
    });
  });

  describe('manual_only — portals that require browser HTML', () => {
    it('returns manual_only for idealista.com', () => {
      const r = screenUrl('https://www.idealista.com/inmueble/12345678/');
      expect(r.verdict).toBe('manual_only');
      expect(r.portalTier).toBe('manual-only');
    });

    it('returns manual_only for idealista.pt', () => {
      const r = screenUrl('https://www.idealista.pt/imovel/12345678/');
      expect(r.verdict).toBe('manual_only');
      expect(r.portalTier).toBe('manual-only');
    });
  });

  describe('portalTier — tier info attached to results', () => {
    it('includes portalTier core for rightmove', () => {
      const r = screenUrl('https://www.rightmove.co.uk/properties/168908774');
      expect(r.verdict).toBe('allowed');
      expect(r.portalTier).toBe('core');
    });

    it('includes portalTier core for zoopla', () => {
      const r = screenUrl('https://www.zoopla.co.uk/for-sale/details/12345678/');
      expect(r.verdict).toBe('allowed');
      expect(r.portalTier).toBe('core');
    });

    it('includes portalTier on search_results verdict', () => {
      const r = screenUrl('https://www.rightmove.co.uk/property-for-sale/London.html');
      expect(r.verdict).toBe('search_results');
      expect(r.portalTier).toBe('core');
    });

    it('does not include portalTier for unknown domains', () => {
      const r = screenUrl('https://www.somenichepropertysite.com/listing/42');
      expect(r.portalTier).toBeUndefined();
    });
  });

  describe('invalid — bad or empty URLs', () => {
    it('returns invalid for empty string', () => {
      expect(screenUrl('').verdict).toBe('invalid');
    });

    it('returns invalid for whitespace', () => {
      expect(screenUrl('   ').verdict).toBe('invalid');
    });

    it('returns invalid for unparseable string', () => {
      expect(screenUrl('not-a-url').verdict).toBe('invalid');
    });

    it('returns invalid for ftp protocol', () => {
      expect(screenUrl('ftp://files.example.com/listing').verdict).toBe('invalid');
    });

    it('returns invalid for javascript protocol', () => {
      expect(screenUrl('javascript:alert(1)').verdict).toBe('invalid');
    });
  });
});
