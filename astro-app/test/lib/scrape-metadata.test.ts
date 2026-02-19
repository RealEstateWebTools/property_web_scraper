import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordScrapeAndUpdatePortal,
  getLatestScrapeForListing,
  getScrapeHistoryForListing,
  getPortalProfile,
  getPortalProfileHistory,
  clearScrapeMetadata,
  type RecordScrapeInput,
} from '../../src/lib/services/scrape-metadata.js';

function makeInput(overrides: Partial<RecordScrapeInput> = {}): RecordScrapeInput {
  return {
    listingId: 'listing-1',
    sourceUrl: 'https://www.rightmove.co.uk/properties/123',
    html: '<html><body><h1>Test Property</h1></body></html>',
    sourceType: 'url_fetch',
    scraperName: 'uk_rightmove',
    portalSlug: 'rightmove',
    ...overrides,
  };
}

describe('scrape-metadata', () => {
  beforeEach(() => {
    clearScrapeMetadata();
  });

  describe('recordScrapeAndUpdatePortal', () => {
    it('creates a ScrapeRecord with correct fields', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput());

      expect(scrape.id).toBeTruthy();
      expect(scrape.timestamp).toBeTruthy();
      expect(scrape.listing_id).toBe('listing-1');
      expect(scrape.source_url).toBe('https://www.rightmove.co.uk/properties/123');
      expect(scrape.source_host).toBe('www.rightmove.co.uk');
      expect(scrape.scraper_name).toBe('uk_rightmove');
      expect(scrape.portal_slug).toBe('rightmove');
      expect(scrape.source_type).toBe('url_fetch');
      expect(scrape.html_size_bytes).toBeGreaterThan(0);
      expect(scrape.html_size_kb).toBeGreaterThan(0);
      expect(scrape.technology_stack).toBeInstanceOf(Array);
      expect(scrape.anti_scraping_signals).toBeInstanceOf(Array);
      expect(scrape.better_html_hint).toBeDefined();
    });

    it('stores scrape retrievable by listing index', async () => {
      await recordScrapeAndUpdatePortal(makeInput());
      const latest = await getLatestScrapeForListing('listing-1');
      expect(latest).toBeDefined();
      expect(latest!.listing_id).toBe('listing-1');
    });

    it('omits listing_id when not provided', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({ listingId: undefined }));
      expect(scrape.listing_id).toBeUndefined();
    });

    it('includes fetch context fields when provided', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        fetchContext: {
          userAgentUsed: 'TestBot/1.0',
          durationMs: 250,
          statusCode: 200,
          responseContentType: 'text/html',
        },
      }));
      expect(scrape.fetch_user_agent).toBe('TestBot/1.0');
      expect(scrape.fetch_duration_ms).toBe(250);
      expect(scrape.response_status).toBe(200);
      expect(scrape.response_content_type).toBe('text/html');
    });

    it('includes diagnostics fields when provided', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.75,
          populatedExtractableFields: 15,
          extractableFields: 20,
          qualityGrade: 'B',
          qualityLabel: 'Good',
          successClassification: 'good',
          expectedExtractionRate: 0.7,
          expectedQualityGrade: 'B',
          populatedFields: 15,
          totalFields: 30,
          meetsExpectation: true,
          expectationGap: 0.05,
          expectationStatus: 'above',
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
          weightedExtractionRate: 0.8,
        },
      }));
      expect(scrape.extracted_fields).toBe(15);
      expect(scrape.extractable_fields).toBe(20);
      expect(scrape.extraction_rate).toBe(0.75);
      expect(scrape.quality_grade).toBe('B');
      expect(scrape.expected_extraction_rate).toBe(0.7);
      expect(scrape.expected_quality_grade).toBe('B');
      expect(scrape.success_classification).toBe('good');
      expect(scrape.meets_expectation).toBe(true);
      expect(scrape.expectation_status).toBe('above');
      expect(scrape.expectation_gap).toBe(0.05);
    });
  });

  describe('getLatestScrapeForListing', () => {
    it('returns undefined when no scrapes exist', async () => {
      const result = await getLatestScrapeForListing('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns the most recent scrape', async () => {
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>first</html>' }));
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>second</html>' }));

      const latest = await getLatestScrapeForListing('listing-1');
      expect(latest).toBeDefined();
      // Second scrape has larger HTML
      expect(latest!.html_size_bytes).toBe('<html>second</html>'.length);
    });
  });

  describe('getScrapeHistoryForListing', () => {
    it('returns empty array when no scrapes exist', async () => {
      const result = await getScrapeHistoryForListing('nonexistent');
      expect(result).toEqual([]);
    });

    it('returns scrapes in reverse chronological order', async () => {
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>one</html>' }));
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>two</html>' }));
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>three</html>' }));

      const history = await getScrapeHistoryForListing('listing-1');
      expect(history).toHaveLength(3);
      // Most recent first
      expect(history[0].html_size_bytes).toBe('<html>three</html>'.length);
      expect(history[2].html_size_bytes).toBe('<html>one</html>'.length);
    });

    it('respects limit parameter', async () => {
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>a</html>' }));
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>b</html>' }));
      await recordScrapeAndUpdatePortal(makeInput({ html: '<html>c</html>' }));

      const history = await getScrapeHistoryForListing('listing-1', 2);
      expect(history).toHaveLength(2);
    });
  });

  describe('getPortalProfile', () => {
    it('returns undefined when no profile exists', async () => {
      const result = await getPortalProfile('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns current profile after recording a scrape', async () => {
      await recordScrapeAndUpdatePortal(makeInput());
      const profile = await getPortalProfile('rightmove');
      expect(profile).toBeDefined();
      expect(profile!.portal_slug).toBe('rightmove');
      expect(profile!.total_samples).toBe(1);
      expect(profile!.scraper_name).toBe('uk_rightmove');
    });

    it('updates rolling averages on subsequent scrapes', async () => {
      const html1 = '<html>' + 'x'.repeat(1000) + '</html>';
      const html2 = '<html>' + 'x'.repeat(3000) + '</html>';

      await recordScrapeAndUpdatePortal(makeInput({ html: html1 }));
      const profile1 = await getPortalProfile('rightmove');
      expect(profile1!.avg_html_size_bytes).toBe(html1.length);

      await recordScrapeAndUpdatePortal(makeInput({ html: html2 }));
      const profile2 = await getPortalProfile('rightmove');
      expect(profile2!.total_samples).toBe(2);
      expect(profile2!.avg_html_size_bytes).toBe((html1.length + html2.length) / 2);
      expect(profile2!.min_html_size_bytes).toBe(html1.length);
      expect(profile2!.max_html_size_bytes).toBe(html2.length);
    });

    it('tracks expectation hit-rate when diagnostics include baseline comparison', async () => {
      await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.8,
          populatedExtractableFields: 8,
          extractableFields: 10,
          qualityGrade: 'B',
          qualityLabel: 'Good',
          successClassification: 'good',
          expectedExtractionRate: 0.75,
          expectedQualityGrade: 'B',
          populatedFields: 10,
          totalFields: 12,
          meetsExpectation: true,
          expectationGap: 0.05,
          expectationStatus: 'above',
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      }));

      await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.4,
          populatedExtractableFields: 4,
          extractableFields: 10,
          qualityGrade: 'C',
          qualityLabel: 'Partial',
          successClassification: 'partial',
          expectedExtractionRate: 0.75,
          expectedQualityGrade: 'B',
          populatedFields: 6,
          totalFields: 12,
          meetsExpectation: false,
          expectationGap: -0.35,
          expectationStatus: 'well_below',
          criticalFieldsMissing: ['title'],
          emptyFields: ['title'],
          fieldTraces: [],
        },
      }));

      const profile = await getPortalProfile('rightmove');
      expect(profile).toBeDefined();
      expect(profile!.expected_extraction_rate).toBe(0.75);
      expect(profile!.expectation_hit_rate).toBe(0.5);
    });
  });

  describe('getPortalProfileHistory', () => {
    it('archives old profile when signature changes', async () => {
      // First scrape: plain HTML (server render mode)
      await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><body><h1>Property</h1></body></html>',
      }));

      // Second scrape: Next.js + JS-only (different signature)
      await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><script id="__NEXT_DATA__">{}</script><div id="__next"></div></html>',
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.1,
          populatedExtractableFields: 1,
          extractableFields: 20,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 1,
          totalFields: 30,
          meetsExpectation: false,
          criticalFieldsMissing: ['title', 'price'],
          emptyFields: ['title'],
          fieldTraces: [],
          contentAnalysis: {
            htmlLength: 100,
            jsonLdCount: 0,
            scriptJsonVarsFound: [],
            appearsBlocked: false,
            appearsJsOnly: true,
          },
        },
      }));

      const history = await getPortalProfileHistory('rightmove');
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].reason).toBe('detected_profile_change');
      expect(history[0].portal_slug).toBe('rightmove');
    });

    it('does not archive when signature is unchanged', async () => {
      await recordScrapeAndUpdatePortal(makeInput());
      await recordScrapeAndUpdatePortal(makeInput());

      const history = await getPortalProfileHistory('rightmove');
      expect(history).toHaveLength(0);
    });
  });

  describe('clearScrapeMetadata', () => {
    it('resets all in-memory stores', async () => {
      await recordScrapeAndUpdatePortal(makeInput());
      clearScrapeMetadata();

      expect(await getLatestScrapeForListing('listing-1')).toBeUndefined();
      expect(await getPortalProfile('rightmove')).toBeUndefined();
      expect(await getPortalProfileHistory('rightmove')).toEqual([]);
    });
  });

  describe('technology stack detection', () => {
    it('detects Next.js from __NEXT_DATA__', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><script id="__NEXT_DATA__">{}</script></html>',
      }));
      expect(scrape.technology_stack).toContain('next.js');
    });

    it('detects React from data-reactroot', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div data-reactroot></div></html>',
      }));
      expect(scrape.technology_stack).toContain('react');
    });

    it('detects Vue', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div id="app" data-vue></div></html>',
      }));
      expect(scrape.technology_stack).toContain('vue');
    });

    it('detects Angular from ng-version', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html ng-version="14.0.0"><body></body></html>',
      }));
      expect(scrape.technology_stack).toContain('angular');
    });

    it('detects WordPress from wp-content', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><link rel="stylesheet" href="/wp-content/themes/test.css"></html>',
      }));
      expect(scrape.technology_stack).toContain('wordpress');
    });

    it('detects Nuxt', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div id="__nuxt"></div></html>',
      }));
      expect(scrape.technology_stack).toContain('nuxt');
    });

    it('returns empty array for plain HTML', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><body><p>Hello</p></body></html>',
      }));
      expect(scrape.technology_stack).toEqual([]);
    });
  });

  describe('anti-scraping signal detection', () => {
    it('detects captcha', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div class="captcha-container">Solve captcha</div></html>',
      }));
      expect(scrape.anti_scraping_signals).toContain('captcha');
    });

    it('detects Cloudflare challenge', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><title>Just a moment...</title><div class="cf-chl-widget"></div></html>',
      }));
      expect(scrape.anti_scraping_signals).toContain('cloudflare_challenge');
    });

    it('detects DataDome', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><script src="https://js.datadome.co/tags.js"></script></html>',
      }));
      expect(scrape.anti_scraping_signals).toContain('datadome');
    });

    it('detects HTTP 429 rate limit', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        fetchContext: { statusCode: 429 },
      }));
      expect(scrape.anti_scraping_signals).toContain('http_429_rate_limit');
    });

    it('returns empty array for clean HTML', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><body><h1>Normal page</h1></body></html>',
      }));
      expect(scrape.anti_scraping_signals).toEqual([]);
    });
  });

  describe('render mode detection', () => {
    it('detects client render mode for JS-only pages', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div id="root"></div><script src="/bundle.js"></script></html>',
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0,
          populatedExtractableFields: 0,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 0,
          totalFields: 10,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
          contentAnalysis: {
            htmlLength: 100,
            jsonLdCount: 0,
            scriptJsonVarsFound: [],
            appearsBlocked: false,
            appearsJsOnly: true,
          },
        },
      }));
      expect(scrape.render_mode).toBe('client');
    });

    it('detects hybrid render mode for React SSR with data', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div data-reactroot><h1>Title</h1></div><script id="__NEXT_DATA__">{}</script></html>',
      }));
      expect(scrape.render_mode).toBe('hybrid');
    });

    it('detects server render mode for plain HTML', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><body><h1>Property Details</h1><p>Address info</p></body></html>',
      }));
      expect(scrape.render_mode).toBe('server');
    });
  });

  describe('buildBetterHtmlHint (via recordScrapeAndUpdatePortal)', () => {
    it('suggests better HTML for url_fetch with JS-only page', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        sourceType: 'url_fetch',
        html: '<html><div id="root"></div></html>',
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0,
          populatedExtractableFields: 0,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 0,
          totalFields: 10,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
          contentAnalysis: {
            htmlLength: 50,
            jsonLdCount: 0,
            scriptJsonVarsFound: [],
            appearsBlocked: false,
            appearsJsOnly: true,
          },
        },
      }));
      expect(scrape.better_html_hint.suggested).toBe(true);
      expect(scrape.better_html_hint.reasons.length).toBeGreaterThan(0);
      expect(scrape.better_html_hint.suggestedActions.length).toBeGreaterThan(0);
    });

    it('does not suggest for manual_html even with JS-only page', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        sourceType: 'manual_html',
        html: '<html><div id="root"></div></html>',
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0,
          populatedExtractableFields: 0,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 0,
          totalFields: 10,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
          contentAnalysis: {
            htmlLength: 50,
            jsonLdCount: 0,
            scriptJsonVarsFound: [],
            appearsBlocked: false,
            appearsJsOnly: true,
          },
        },
      }));
      expect(scrape.better_html_hint.suggested).toBe(false);
    });

    it('suggests for url_fetch with low extraction rate', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        sourceType: 'url_fetch',
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0.2,
          populatedExtractableFields: 2,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 2,
          totalFields: 20,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      }));
      expect(scrape.better_html_hint.suggested).toBe(true);
    });

    it('does not suggest for clean url_fetch with good extraction', async () => {
      const scrape = await recordScrapeAndUpdatePortal(makeInput({
        sourceType: 'url_fetch',
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0.85,
          populatedExtractableFields: 17,
          extractableFields: 20,
          qualityGrade: 'A',
          qualityLabel: 'Excellent',
          populatedFields: 17,
          totalFields: 30,
          meetsExpectation: true,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      }));
      expect(scrape.better_html_hint.suggested).toBe(false);
    });
  });

  describe('rolling averages', () => {
    it('updates avg_html_size_bytes correctly across scrapes', async () => {
      const html1 = 'a'.repeat(1000);
      const html2 = 'b'.repeat(2000);
      const html3 = 'c'.repeat(3000);

      await recordScrapeAndUpdatePortal(makeInput({ html: html1 }));
      const p1 = await getPortalProfile('rightmove');
      expect(p1!.avg_html_size_bytes).toBe(1000);

      await recordScrapeAndUpdatePortal(makeInput({ html: html2 }));
      const p2 = await getPortalProfile('rightmove');
      expect(p2!.avg_html_size_bytes).toBe(1500);

      await recordScrapeAndUpdatePortal(makeInput({ html: html3 }));
      const p3 = await getPortalProfile('rightmove');
      expect(p3!.avg_html_size_bytes).toBe(2000);
    });

    it('tracks js_only_rate as rolling average', async () => {
      // JS-only
      await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'test',
          extractionRate: 0,
          populatedExtractableFields: 0,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          populatedFields: 0,
          totalFields: 10,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
          contentAnalysis: {
            htmlLength: 50,
            jsonLdCount: 0,
            scriptJsonVarsFound: [],
            appearsBlocked: false,
            appearsJsOnly: true,
          },
        },
      }));
      const p1 = await getPortalProfile('rightmove');
      expect(p1!.js_only_rate).toBe(1);

      // Not JS-only
      await recordScrapeAndUpdatePortal(makeInput());
      const p2 = await getPortalProfile('rightmove');
      expect(p2!.js_only_rate).toBe(0.5);
    });
  });

  describe('consecutive_below_threshold counter', () => {
    it('starts at 0 when meets_expectation is true', async () => {
      await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.9,
          populatedExtractableFields: 18,
          extractableFields: 20,
          qualityGrade: 'A',
          qualityLabel: 'Excellent',
          successClassification: 'excellent',
          expectedExtractionRate: 0.85,
          expectedQualityGrade: 'A',
          populatedFields: 18,
          totalFields: 30,
          meetsExpectation: true,
          expectationGap: 0.05,
          expectationStatus: 'above',
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      }));
      const profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(0);
    });

    it('increments on consecutive failures', async () => {
      const failInput = {
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.3,
          populatedExtractableFields: 3,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          successClassification: 'failed' as const,
          expectedExtractionRate: 0.85,
          expectedQualityGrade: 'A',
          populatedFields: 3,
          totalFields: 30,
          meetsExpectation: false,
          expectationGap: -0.55,
          expectationStatus: 'well_below' as const,
          criticalFieldsMissing: ['title'],
          emptyFields: ['title'],
          fieldTraces: [],
        },
      };

      await recordScrapeAndUpdatePortal(makeInput(failInput));
      let profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(1);

      await recordScrapeAndUpdatePortal(makeInput(failInput));
      profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(2);

      await recordScrapeAndUpdatePortal(makeInput(failInput));
      profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(3);
    });

    it('resets to 0 when a scrape meets expectation', async () => {
      const failInput = {
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.3,
          populatedExtractableFields: 3,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          successClassification: 'failed' as const,
          expectedExtractionRate: 0.85,
          expectedQualityGrade: 'A',
          populatedFields: 3,
          totalFields: 30,
          meetsExpectation: false,
          expectationGap: -0.55,
          expectationStatus: 'well_below' as const,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      };
      const passInput = {
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.9,
          populatedExtractableFields: 18,
          extractableFields: 20,
          qualityGrade: 'A',
          qualityLabel: 'Excellent',
          successClassification: 'excellent' as const,
          expectedExtractionRate: 0.85,
          expectedQualityGrade: 'A',
          populatedFields: 18,
          totalFields: 30,
          meetsExpectation: true,
          expectationGap: 0.05,
          expectationStatus: 'above' as const,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      };

      // 3 failures
      await recordScrapeAndUpdatePortal(makeInput(failInput));
      await recordScrapeAndUpdatePortal(makeInput(failInput));
      await recordScrapeAndUpdatePortal(makeInput(failInput));
      let profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(3);

      // 1 success resets
      await recordScrapeAndUpdatePortal(makeInput(passInput));
      profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(0);
    });

    it('stays unchanged when meets_expectation is undefined', async () => {
      // First scrape with failure
      await recordScrapeAndUpdatePortal(makeInput({
        diagnostics: {
          scraperName: 'uk_rightmove',
          extractionRate: 0.3,
          populatedExtractableFields: 3,
          extractableFields: 10,
          qualityGrade: 'F',
          qualityLabel: 'Poor',
          successClassification: 'failed',
          populatedFields: 3,
          totalFields: 30,
          meetsExpectation: false,
          criticalFieldsMissing: [],
          emptyFields: [],
          fieldTraces: [],
        },
      }));
      let profile = await getPortalProfile('rightmove');
      expect(profile!.consecutive_below_threshold).toBe(1);

      // Scrape without meets_expectation (no diagnostics)
      await recordScrapeAndUpdatePortal(makeInput());
      profile = await getPortalProfile('rightmove');
      // Should stay at 1 since meets_expectation was undefined
      expect(profile!.consecutive_below_threshold).toBe(1);
    });
  });

  describe('portal profile signature change', () => {
    it('archives when technology stack changes', async () => {
      // Plain HTML
      await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><body>Plain page</body></html>',
      }));

      // Now with React
      await recordScrapeAndUpdatePortal(makeInput({
        html: '<html><div data-reactroot><h1>React page</h1></div></html>',
      }));

      const history = await getPortalProfileHistory('rightmove');
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });
});
