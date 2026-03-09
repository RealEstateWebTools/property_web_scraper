import { describe, it, expect } from 'vitest';
import {
  PORTAL_REGISTRY,
  findPortalByHost,
  findPortalByUrl,
  findPortalByName,
  allPortalNames,
  listSupportedSites,
} from '../../src/lib/services/portal-registry.js';

describe('portal-registry', () => {
  describe('PORTAL_REGISTRY', () => {
    it('contains all hardcoded portals', () => {
      expect(Object.keys(PORTAL_REGISTRY)).toHaveLength(109);
    });

    it('each portal has required fields', () => {
      for (const [name, config] of Object.entries(PORTAL_REGISTRY)) {
        expect(config.scraperName, `${name}.scraperName`).toBeTruthy();
        expect(config.slug, `${name}.slug`).toBeTruthy();
        expect(config.hosts.length, `${name}.hosts`).toBeGreaterThan(0);
        expect(config.country, `${name}.country`).toMatch(/^[A-Z]{2}$/);
        expect(config.currency, `${name}.currency`).toMatch(/^[A-Z]{3}$/);
        expect(config.localeCode, `${name}.localeCode`).toBeTruthy();
        expect(config.areaUnit, `${name}.areaUnit`).toBeTruthy();
        expect(config.contentSource, `${name}.contentSource`).toMatch(
          /^(html|script-json|json-ld|flight-data)$/
        );
        expect(typeof config.stripTrailingSlash).toBe('boolean');
        expect(typeof config.requiresJsRendering).toBe('boolean');
      }
    });

    it('each portal has a valid supportTier', () => {
      for (const [name, config] of Object.entries(PORTAL_REGISTRY)) {
        expect(
          ['core', 'experimental', 'manual-only'],
          `${name}.supportTier should be valid`,
        ).toContain(config.supportTier);
      }
    });

    it('each portal has expectedExtractionRate set', () => {
      for (const [name, config] of Object.entries(PORTAL_REGISTRY)) {
        expect(config.expectedExtractionRate, `${name}.expectedExtractionRate`).toBeTypeOf('number');
        expect(config.expectedExtractionRate!, `${name}.expectedExtractionRate range`).toBeGreaterThan(0);
        expect(config.expectedExtractionRate!, `${name}.expectedExtractionRate range`).toBeLessThanOrEqual(1);
      }
    });

    it('manual-only portals have requiresJsRendering true', () => {
      for (const [name, config] of Object.entries(PORTAL_REGISTRY)) {
        if (config.supportTier === 'manual-only') {
          expect(config.requiresJsRendering, `${name} should require JS rendering`).toBe(true);
        }
      }
    });

    it('has expected portals', () => {
      const names = Object.keys(PORTAL_REGISTRY);
      expect(names).toContain('uk_rightmove');
      expect(names).toContain('es_idealista');
      expect(names).toContain('uk_zoopla');
      expect(names).toContain('us_realtor');
      expect(names).toContain('es_fotocasa');
      expect(names).toContain('es_pisos');
      expect(names).toContain('in_realestateindia');
      expect(names).toContain('us_forsalebyowner');
      expect(names).toContain('uk_jitty');
      expect(names).toContain('uk_onthemarket');
      expect(names).toContain('ie_daft');
      expect(names).toContain('pt_idealista');
      expect(names).toContain('us_redfin');
      expect(names).toContain('us_zillow');
      expect(names).toContain('us_trulia');
      expect(names).toContain('nl_funda');
      expect(names).toContain('se_hemnet');
      expect(names).toContain('fr_seloger');
      expect(names).toContain('it_immobiliare');
      expect(names).toContain('us_mlslistings');
      expect(names).toContain('us_wyomingmls');
      expect(names).toContain('pa_encuentra24');
    });
  });

  describe('findPortalByHost', () => {
    it('finds rightmove by www hostname', () => {
      const portal = findPortalByHost('www.rightmove.co.uk');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('uk_rightmove');
      expect(portal!.country).toBe('GB');
      expect(portal!.currency).toBe('GBP');
    });

    it('finds rightmove by bare hostname', () => {
      const portal = findPortalByHost('rightmove.co.uk');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('uk_rightmove');
    });

    it('finds idealista', () => {
      const portal = findPortalByHost('www.idealista.com');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('es_idealista');
      expect(portal!.country).toBe('ES');
      expect(portal!.currency).toBe('EUR');
    });

    it('finds daft.ie', () => {
      const portal = findPortalByHost('www.daft.ie');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('ie_daft');
      expect(portal!.country).toBe('IE');
    });

    it('finds redfin with dedicated scraper', () => {
      const portal = findPortalByHost('www.redfin.com');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('us_redfin');
      expect(portal!.supportTier).toBe('core');
      expect(portal!.country).toBe('US');
    });

    it('finds zillow with us_zillow scraper', () => {
      const portal = findPortalByHost('www.zillow.com');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('us_zillow');
      expect(portal!.supportTier).toBe('experimental');
    });

    it('finds funda.nl with dedicated scraper', () => {
      const portal = findPortalByHost('www.funda.nl');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('nl_funda');
      expect(portal!.supportTier).toBe('core');
      expect(portal!.country).toBe('NL');
    });

    it('returns undefined for unknown host', () => {
      expect(findPortalByHost('www.unknown-site.com')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(findPortalByHost('')).toBeUndefined();
    });
  });

  describe('findPortalByName', () => {
    it('finds portal by registry key', () => {
      const portal = findPortalByName('uk_rightmove');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('uk_rightmove');
    });

    it('finds zoopla by new key', () => {
      const portal = findPortalByName('uk_zoopla');
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('uk_zoopla');
    });

    it('returns undefined for unknown name', () => {
      expect(findPortalByName('nonexistent')).toBeUndefined();
    });
  });

  describe('findPortalByUrl', () => {
    it('matches panama encuentra24 URLs to the Panama scraper', () => {
      const portal = findPortalByUrl(new URL('https://www.encuentra24.com/panama/bienes-raices-venta/12345'));
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('pa_encuentra24');
      expect(portal!.country).toBe('PA');
    });

    it('matches costa rica encuentra24 URLs to the Costa Rica scraper', () => {
      const portal = findPortalByUrl(new URL('https://www.encuentra24.com/costa-rica/bienes-raices-venta/12345'));
      expect(portal).toBeDefined();
      expect(portal!.scraperName).toBe('cr_encuentra24');
      expect(portal!.country).toBe('CR');
    });
  });

  describe('allPortalNames', () => {
    it('returns array of all portal names', () => {
      const names = allPortalNames();
      expect(names).toHaveLength(109);
      expect(names).toContain('uk_rightmove');
      expect(names).toContain('es_idealista');
    });

    it('returns strings', () => {
      for (const name of allPortalNames()) {
        expect(typeof name).toBe('string');
      }
    });
  });

  describe('listSupportedSites', () => {
    it('returns one canonical site per scraper with support metadata', () => {
      const sites = listSupportedSites();
      expect(sites).toHaveLength(109);
      expect(sites[0]).toHaveProperty('host');
      expect(sites[0]).toHaveProperty('supportTier');
      expect(sites[0]).toHaveProperty('url');
    });
  });
});
