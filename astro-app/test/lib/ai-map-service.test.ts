/**
 * Tests for ai-map-service — HTML analysis and mapping response parsing.
 * LLM calls are NOT tested (they require API keys).
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeHtmlStructure,
  buildMappingPrompt,
  parseMappingResponse,
} from '../../src/lib/services/ai-map-service.js';

describe('analyzeHtmlStructure', () => {
  it('detects JSON-LD in HTML', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@type":"Residence","name":"Test Property","geo":{"latitude":51.5}}</script>
      </head><body></body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.hasJsonLd).toBe(true);
    expect(analysis.jsonLdTypes).toContain('Residence');
    expect(analysis.jsonLdSample).toContain('Residence');
  });

  it('detects script variables', () => {
    const html = `
      <html><body>
        <script>window.PAGE_MODEL = {"propertyData":{"id":"123"}}</script>
      </body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.scriptVars).toContain('PAGE_MODEL');
    expect(analysis.detectedSource).toBe('script-json');
  });

  it('detects __NEXT_DATA__', () => {
    const html = `
      <html><body>
        <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"listing":{}}}}</script>
        <script>window.__NEXT_DATA__ = {"props":{}}</script>
      </body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.scriptVars).toContain('__NEXT_DATA__');
  });

  it('detects mixed sources', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@type":"House"}</script>
      </head><body>
        <script>var PAGE_MODEL = {"listing":{}}</script>
      </body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.detectedSource).toBe('mixed');
    expect(analysis.hasJsonLd).toBe(true);
    expect(analysis.scriptVars).toContain('PAGE_MODEL');
  });

  it('detects HTML-only when no structured data found', () => {
    const html = `
      <html><head><meta name="description" content="Nice flat"></head>
      <body><h1>2 Bed Flat</h1><p>A lovely property</p></body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.detectedSource).toBe('html');
    expect(analysis.hasJsonLd).toBe(false);
    expect(analysis.scriptVars).toHaveLength(0);
  });

  it('extracts meta tags', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Beautiful Apartment" />
        <meta name="description" content="3 bed apartment" />
      </head><body></body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.metaTags['og:title']).toBe('Beautiful Apartment');
    expect(analysis.metaTags['description']).toBe('3 bed apartment');
  });

  it('extracts heading texts', () => {
    const html = `
      <html><body>
        <h1>3 Bedroom House for Sale</h1>
        <h2>Property Details</h2>
        <h3>Location</h3>
      </body></html>
    `;
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.headingTexts).toContain('3 Bedroom House for Sale');
    expect(analysis.headingTexts).toHaveLength(3);
  });

  it('reports HTML length', () => {
    const html = '<html><body>test</body></html>';
    const analysis = analyzeHtmlStructure(html);
    expect(analysis.htmlLength).toBe(html.length);
  });
});

describe('buildMappingPrompt', () => {
  it('includes source URL', () => {
    const analysis = analyzeHtmlStructure('<html><body></body></html>');
    const prompt = buildMappingPrompt(analysis, 'https://example.com/listing/123');
    expect(prompt).toContain('https://example.com/listing/123');
  });

  it('includes JSON-LD info when present', () => {
    const html = '<html><head><script type="application/ld+json">{"@type":"Residence"}</script></head><body></body></html>';
    const analysis = analyzeHtmlStructure(html);
    const prompt = buildMappingPrompt(analysis, 'https://example.com');
    expect(prompt).toContain('JSON-LD');
    expect(prompt).toContain('Residence');
  });

  it('includes script var info when present', () => {
    const html = '<html><body><script>window.PAGE_MODEL = {}</script></body></html>';
    const analysis = analyzeHtmlStructure(html);
    const prompt = buildMappingPrompt(analysis, 'https://example.com');
    expect(prompt).toContain('PAGE_MODEL');
  });

  it('includes target field names', () => {
    const analysis = analyzeHtmlStructure('<html></html>');
    const prompt = buildMappingPrompt(analysis, 'https://example.com');
    expect(prompt).toContain('title');
    expect(prompt).toContain('price_string');
    expect(prompt).toContain('count_bedrooms');
    expect(prompt).toContain('latitude');
  });
});

describe('parseMappingResponse', () => {
  it('parses valid JSON mapping', () => {
    const raw = JSON.stringify({
      name: 'test_portal',
      textFields: { title: { cssLocator: 'h1' }, price_string: { cssLocator: '.price' } },
      intFields: { count_bedrooms: { cssLocator: '.beds' } },
    });
    const result = parseMappingResponse(raw, 'test_portal');
    expect(result.mapping.name).toBe('test_portal');
    expect(result.mapping.textFields?.title.cssLocator).toBe('h1');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('handles array-wrapped mapping', () => {
    const raw = JSON.stringify([{
      name: 'test',
      textFields: { title: { cssLocator: 'h1' } },
    }]);
    const result = parseMappingResponse(raw, 'test');
    expect(result.mapping.name).toBe('test');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"name":"test","textFields":{"title":{"cssLocator":"h1"}}}\n```';
    const result = parseMappingResponse(raw, 'test');
    expect(result.mapping.textFields?.title.cssLocator).toBe('h1');
  });

  it('overrides name with scraperName argument', () => {
    const raw = JSON.stringify({ name: 'wrong_name', textFields: { title: { cssLocator: 'h1' } } });
    const result = parseMappingResponse(raw, 'correct_name');
    expect(result.mapping.name).toBe('correct_name');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseMappingResponse('not json', 'test')).toThrow('invalid JSON');
  });

  it('reports low confidence when no fields mapped', () => {
    const raw = JSON.stringify({ name: 'test' });
    const result = parseMappingResponse(raw, 'test');
    expect(result.confidence).toBe(0);
    expect(result.notes.some(n => n.includes('No fields'))).toBe(true);
  });

  it('notes image extraction status', () => {
    const raw = JSON.stringify({
      name: 'test',
      textFields: { title: { cssLocator: 'h1' } },
      images: [{ cssLocator: '.gallery img', cssAttr: 'src' }],
    });
    const result = parseMappingResponse(raw, 'test');
    expect(result.notes.some(n => n.includes('Image extraction configured'))).toBe(true);
  });
});
