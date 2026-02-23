import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';
import { findByName } from '../../src/lib/extractor/mapping-loader.js';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', 'fixtures', `${name}.html`), 'utf-8');
}

describe('HtmlExtractor', () => {
  describe('.extractFromHtml basic behavior', () => {
    it('returns error for unknown mapping name', () => {
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://example.com',
        scraperMappingName: 'nonexistent',
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/Unknown scraper mapping/);
    });

    it('accepts a pre-loaded scraper mapping', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });
      expect(result.success).toBe(true);
      expect(result.properties).toBeInstanceOf(Array);
    });

    it('handles empty HTML gracefully', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });
      expect(result.success).toBe(true);
      expect(result.properties[0]).toBeDefined();
    });

    it('handles malformed HTML gracefully', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<div><p>unclosed',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });
      expect(result.success).toBe(true);
      expect(result.properties[0]).toBeDefined();
    });
  });

  describe('extraction diagnostics', () => {
    it('includes diagnostics in the result', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics!.scraperName).toBe('es_idealista');
      expect(result.diagnostics!.fieldTraces).toBeInstanceOf(Array);
      expect(result.diagnostics!.fieldTraces.length).toBe(result.diagnostics!.totalFields);
      expect(result.diagnostics!.emptyFields).toBeInstanceOf(Array);
    });

    it('traces contain expected properties', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.populatedFields).toBeGreaterThan(0);
      expect(diag.totalFields).toBeGreaterThan(diag.emptyFields.length);

      const titleTrace = diag.fieldTraces.find(t => t.field === 'title');
      expect(titleTrace).toBeDefined();
      expect(titleTrace!.section).toBe('textFields');
      expect(titleTrace!.strategy).toMatch(/cssLocator|scriptJsonPath|jsonLdPath/);
      expect(titleTrace!.rawText).not.toBe('');
    });

    it('reports empty fields when HTML has no matching data', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<html><body></body></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      const diag = result.diagnostics!;
      expect(diag.emptyFields.length).toBeGreaterThan(0);
      expect(diag.populatedFields).toBeLessThan(diag.totalFields);
    });

    it('includes quality scoring fields in diagnostics', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.extractableFields).toBeGreaterThan(0);
      expect(diag.populatedExtractableFields).toBeGreaterThan(0);
      expect(diag.populatedExtractableFields).toBeLessThanOrEqual(diag.extractableFields!);
      expect(diag.extractionRate).toBeGreaterThan(0);
      expect(diag.extractionRate).toBeLessThanOrEqual(1);
      expect(['A', 'B', 'C', 'F']).toContain(diag.qualityGrade);
      expect(['excellent', 'good', 'partial', 'failed']).toContain(diag.successClassification);
      expect(diag.qualityLabel).toBeTruthy();
      expect(typeof diag.meetsExpectation).toBe('boolean');
      expect(['unknown', 'above', 'meets', 'below', 'well_below']).toContain(diag.expectationStatus);
    });

    it('excludes defaultValues from extractable field count', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<html><body></body></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      const diag = result.diagnostics!;
      const defaultTraces = diag.fieldTraces.filter(t => t.section === 'defaultValues');
      expect(defaultTraces.length).toBeGreaterThan(0);
      expect(diag.extractableFields).toBe(diag.totalFields - defaultTraces.length);
    });

    it('assigns grade F for empty HTML with no extractable data', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      const diag = result.diagnostics!;
      expect(diag.qualityGrade).toBe('F');
      expect(diag.populatedExtractableFields).toBe(0);
      expect(diag.extractionRate).toBe(0);
    });

    it('passes through expectedExtractionRate from mapping', () => {
      const mapping = findByName('es_idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      const diag = result.diagnostics!;
      expect(diag.expectedExtractionRate).toBe(mapping!.expectedExtractionRate);
      if (mapping?.expectedExtractionRate != null) {
        expect(diag.expectedQualityGrade).toBeTruthy();
        expect(typeof diag.expectationGap).toBe('number');
      }
    });
  });

  describe('idealista extraction from raw HTML', () => {
    it('extracts the same values as the manifest', () => {
      const html = loadFixture('es_idealista');
      const sourceUrl = 'https://www.idealista.com/en/inmueble/106387165/';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'es_idealista',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];

      expect(props['title']).toContain('Duplex for sale in Calle de Alcal');
      expect(props['price_float']).toBe(3600000);
      expect(props['currency']).toBe('EUR');
      expect(props['constructed_area']).toBe(273);
      expect(props['reference']).toBe('106387165');
      expect(props['for_sale']).toBe(true);
      expect(props['for_rent']).toBe(false);
    });
  });

  describe('rightmove extraction from raw HTML', () => {
    it('extracts the same values as the manifest', () => {
      const html = loadFixture('rightmove_v2');
      const sourceUrl = 'https://www.rightmove.co.uk/properties/168908774';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'uk_rightmove',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];

      expect(props['title']).toBe('2 bedroom apartment for sale in Augustine Way, Oxford, OX4');
      expect(props['address_string']).toBe('Augustine Way, Oxford');
      expect(props['price_string']).toBe('\u00A3105,000');
      expect(props['price_float']).toBe(105000);
      expect(props['count_bedrooms']).toBe(2);
      expect(props['count_bathrooms']).toBe(1);
      expect(props['latitude']).toBe(51.73383);
      expect(props['longitude']).toBe(-1.23336);
      expect(props['reference']).toBe('168908774');
      expect(props['postal_code']).toBe('OX4 4DG');
      expect(props['currency']).toBe('GBP');
      expect(props['for_sale']).toBe(true);
      expect(props['for_rent']).toBe(false);
    });
  });

  describe('realtor extraction from raw HTML', () => {
    it('extracts property data from raw HTML', () => {
      const html = loadFixture('us_realtor');
      const sourceUrl =
        'https://www.realtor.com/realestateandhomes-detail/2200-Pacific-Ave-B1_San-Francisco_CA_94115_M20341-51800';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'us_realtor',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];
      expect(props).toBeDefined();
      expect(props).toHaveProperty('title');
    });
  });

  describe('weighted quality scoring in diagnostics', () => {
    it('includes weightedExtractionRate in diagnostics', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.weightedExtractionRate).toBeDefined();
      expect(diag.weightedExtractionRate).toBeGreaterThan(0);
      expect(diag.weightedExtractionRate).toBeLessThanOrEqual(1);
    });

    it('includes criticalFieldsMissing in diagnostics', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.criticalFieldsMissing).toBeDefined();
      expect(Array.isArray(diag.criticalFieldsMissing)).toBe(true);
    });

    it('reports critical fields missing when extraction finds no data', () => {
      const result = extractFromHtml({
        html: '<html><body></body></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMappingName: 'es_idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.criticalFieldsMissing!.length).toBeGreaterThan(0);
      expect(diag.criticalFieldsMissing).toContain('title');
    });
  });

  describe('content analysis in diagnostics', () => {
    it('includes contentAnalysis in diagnostics', () => {
      const html = loadFixture('rightmove_v2');
      const result = extractFromHtml({
        html,
        sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
        scraperMappingName: 'uk_rightmove',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca).toBeDefined();
      expect(ca.htmlLength).toBeGreaterThan(0);
      expect(typeof ca.hasScriptTags).toBe('boolean');
      expect(typeof ca.jsonLdCount).toBe('number');
      expect(Array.isArray(ca.scriptJsonVarsFound)).toBe(true);
      expect(typeof ca.appearsBlocked).toBe('boolean');
      expect(typeof ca.appearsJsOnly).toBe('boolean');
    });

    it('detects known script vars in rightmove fixture', () => {
      const html = loadFixture('rightmove_v2');
      const result = extractFromHtml({
        html,
        sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
        scraperMappingName: 'uk_rightmove',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      // The fixture contains dataLayer
      expect(ca.scriptJsonVarsFound.length).toBeGreaterThan(0);
    });

    it('detects blocked page', () => {
      const html = '<html><body>Please verify you are human. Captcha required.</body></html>';
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMappingName: 'es_idealista',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca.appearsBlocked).toBe(true);
    });

    it('does not flag normal page as blocked', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca.appearsBlocked).toBe(false);
    });
  });

  describe('split schema in result', () => {
    it('includes splitSchema in extraction result', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      expect(result.splitSchema).toBeDefined();
      expect(result.splitSchema!.assetData).toBeDefined();
      expect(result.splitSchema!.listingData).toBeDefined();
      expect(result.splitSchema!.unmapped).toBeDefined();
    });

    it('places title in listingData', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      expect(result.splitSchema!.listingData.title).toBeTruthy();
    });

    it('places price fields in listingData', () => {
      const html = loadFixture('es_idealista');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'es_idealista',
      });

      expect(result.splitSchema!.listingData.price_float).toBeTruthy();
      expect(result.splitSchema!.listingData.for_sale).toBeDefined();
    });
  });
});
