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
      const mapping = findByName('idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });
      expect(result.success).toBe(true);
      expect(result.properties).toBeInstanceOf(Array);
    });

    it('handles empty HTML gracefully', () => {
      const mapping = findByName('idealista');
      const result = extractFromHtml({
        html: '',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });
      expect(result.success).toBe(true);
      expect(result.properties[0]).toBeDefined();
    });

    it('handles malformed HTML gracefully', () => {
      const mapping = findByName('idealista');
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
      const mapping = findByName('idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics!.scraperName).toBe('idealista');
      expect(result.diagnostics!.fieldTraces).toBeInstanceOf(Array);
      expect(result.diagnostics!.fieldTraces.length).toBe(result.diagnostics!.totalFields);
      expect(result.diagnostics!.emptyFields).toBeInstanceOf(Array);
    });

    it('traces contain expected properties', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
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
      const mapping = findByName('idealista');
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
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.extractableFields).toBeGreaterThan(0);
      expect(diag.populatedExtractableFields).toBeGreaterThan(0);
      expect(diag.populatedExtractableFields).toBeLessThanOrEqual(diag.extractableFields);
      expect(diag.extractionRate).toBeGreaterThan(0);
      expect(diag.extractionRate).toBeLessThanOrEqual(1);
      expect(['A', 'B', 'C', 'F']).toContain(diag.qualityGrade);
      expect(diag.qualityLabel).toBeTruthy();
      expect(typeof diag.meetsExpectation).toBe('boolean');
    });

    it('excludes defaultValues from extractable field count', () => {
      const mapping = findByName('idealista');
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
      const mapping = findByName('idealista');
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
      const mapping = findByName('idealista');
      const result = extractFromHtml({
        html: '<html></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMapping: mapping!,
      });

      const diag = result.diagnostics!;
      expect(diag.expectedExtractionRate).toBe(mapping!.expectedExtractionRate);
    });
  });

  describe('idealista extraction from raw HTML', () => {
    it('extracts the same values as the Ruby specs', () => {
      const html = loadFixture('idealista_2018_01');
      const sourceUrl = 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'idealista',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];

      expect(props['title']).toBe('Piso en venta en goya, 54, Goya, Madrid');
      expect(props['price_string']).toBe('990.000');
      expect(props['price_float']).toBe(990000.0);
      expect(props['currency']).toBe('EUR');
      expect(props['constructed_area']).toBe(172);
      expect(props['reference']).toBe('38604738');
      expect(props['for_sale']).toBe(true);
      expect(props['latitude']).toBe(40.4246556);
      expect(props['longitude']).toBe(-3.678188);
      expect(props['image_urls']).toBeInstanceOf(Array);
      expect(props['image_urls'][18]).toBe(
        'https://img3.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/48/37/34/254187544.jpg'
      );
    });
  });

  describe('rightmove extraction from raw HTML', () => {
    it('extracts the same values as the Ruby specs', () => {
      const html = loadFixture('rightmove');
      const sourceUrl = 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'rightmove',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];

      expect(props['for_rent']).toBe(true);
      expect(props['longitude']).toBe(-1.8683744229091472);
      expect(props['latitude']).toBe(52.413249369181294);
      expect(props['postal_code']).toBe('B14 4JP');
      expect(props['reference']).toBe('51775029');
      expect(props['image_urls'][0]).toBe(
        'http://media.rightmove.co.uk/dir/147k/146672/51775029/146672_87_School_Rd_IMG_00_0000.jpg'
      );
      expect(props['title']).toBe(
        '4 bedroom detached house to rent in School Road, Birmingham, B14, B14'
      );
      expect(props['address_string']).toBe('School Road, Birmingham, B14');
      expect(props['currency']).toBe('GBP');
      expect(props['price_string']).toBe('\u00A3995 pcm');
      expect(props['price_float']).toBe(995.0);
    });
  });

  describe('realtor extraction from raw HTML', () => {
    it('extracts property data from raw HTML', () => {
      const html = loadFixture('realtor');
      const sourceUrl =
        'http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296';

      const result = extractFromHtml({
        html,
        sourceUrl,
        scraperMappingName: 'realtor',
      });

      expect(result.success).toBe(true);
      const props = result.properties[0];
      expect(props).toBeDefined();
      expect(props).toHaveProperty('title');
    });
  });

  describe('weighted quality scoring in diagnostics', () => {
    it('includes weightedExtractionRate in diagnostics', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.weightedExtractionRate).toBeDefined();
      expect(diag.weightedExtractionRate).toBeGreaterThan(0);
      expect(diag.weightedExtractionRate).toBeLessThanOrEqual(1);
    });

    it('includes criticalFieldsMissing in diagnostics', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.criticalFieldsMissing).toBeDefined();
      expect(Array.isArray(diag.criticalFieldsMissing)).toBe(true);
    });

    it('reports critical fields missing when extraction finds no data', () => {
      const result = extractFromHtml({
        html: '<html><body></body></html>',
        sourceUrl: 'https://www.idealista.com/inmueble/123/',
        scraperMappingName: 'idealista',
      });

      const diag = result.diagnostics!;
      expect(diag.criticalFieldsMissing!.length).toBeGreaterThan(0);
      expect(diag.criticalFieldsMissing).toContain('title');
    });
  });

  describe('content analysis in diagnostics', () => {
    it('includes contentAnalysis in diagnostics', () => {
      const html = loadFixture('rightmove');
      const result = extractFromHtml({
        html,
        sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
        scraperMappingName: 'rightmove',
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
      const html = loadFixture('rightmove');
      const result = extractFromHtml({
        html,
        sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
        scraperMappingName: 'rightmove',
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
        scraperMappingName: 'idealista',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca.appearsBlocked).toBe(true);
    });

    it('does not flag normal page as blocked', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca.appearsBlocked).toBe(false);
    });
  });

  describe('split schema in result', () => {
    it('includes splitSchema in extraction result', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      expect(result.splitSchema).toBeDefined();
      expect(result.splitSchema!.assetData).toBeDefined();
      expect(result.splitSchema!.listingData).toBeDefined();
      expect(result.splitSchema!.unmapped).toBeDefined();
    });

    it('places title in assetData', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      expect(result.splitSchema!.assetData.title).toBeTruthy();
    });

    it('places price fields in listingData', () => {
      const html = loadFixture('idealista_2018_01');
      const result = extractFromHtml({
        html,
        sourceUrl: 'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        scraperMappingName: 'idealista',
      });

      expect(result.splitSchema!.listingData.price_string).toBeTruthy();
      expect(result.splitSchema!.listingData.for_sale).toBeDefined();
    });
  });
});
