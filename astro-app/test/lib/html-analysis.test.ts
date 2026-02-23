/**
 * Tests for html-analysis.ts — pure functions for technology detection,
 * anti-scraping signals, render mode, and better-HTML hints.
 */

import { describe, it, expect } from 'vitest';
import {
  detectTechnologyStack,
  detectAntiScrapingSignals,
  detectRenderMode,
  buildBetterHtmlHint,
} from '../../src/lib/services/html-analysis.js';

// ── detectTechnologyStack ─────────────────────────────────────────────────────

describe('detectTechnologyStack', () => {
  it('returns empty array for plain HTML', () => {
    expect(detectTechnologyStack('<html><body><h1>Hello</h1></body></html>')).toEqual([]);
  });

  it('detects next.js from __next_data__', () => {
    const html = '<script id="__NEXT_DATA__">{"props":{}}</script>';
    expect(detectTechnologyStack(html)).toContain('next.js');
  });

  it('detects next.js from /_next/ path', () => {
    const html = '<script src="/_next/static/chunks/main.js"></script>';
    expect(detectTechnologyStack(html)).toContain('next.js');
  });

  it('detects react from data-reactroot', () => {
    const html = '<div data-reactroot></div>';
    expect(detectTechnologyStack(html)).toContain('react');
  });

  it('detects react keyword', () => {
    const html = '<script>window.React = {};</script>';
    expect(detectTechnologyStack(html)).toContain('react');
  });

  it('detects nuxt from __nuxt', () => {
    const html = '<div id="__nuxt"></div>';
    expect(detectTechnologyStack(html)).toContain('nuxt');
  });

  it('detects vue keyword', () => {
    const html = '<div data-v-app><script>const app = Vue.createApp({})</script></div>';
    expect(detectTechnologyStack(html)).toContain('vue');
  });

  it('detects angular from ng-version', () => {
    const html = '<app-root ng-version="17.0.0"></app-root>';
    expect(detectTechnologyStack(html)).toContain('angular');
  });

  it('detects astro from /_astro/ path', () => {
    const html = '<link rel="stylesheet" href="/_astro/main.css">';
    expect(detectTechnologyStack(html)).toContain('astro');
  });

  it('detects wordpress from wp-content', () => {
    const html = '<link href="/wp-content/themes/my-theme/style.css">';
    expect(detectTechnologyStack(html)).toContain('wordpress');
  });

  it('detects shopify keyword', () => {
    const html = '<script>window.Shopify = {};</script>';
    expect(detectTechnologyStack(html)).toContain('shopify');
  });

  it('returns sorted deduplicated results', () => {
    const html = '<div data-reactroot></div><script src="/_next/static/main.js"></script>';
    const stack = detectTechnologyStack(html);
    const sorted = [...stack].sort();
    expect(stack).toEqual(sorted);
    // next.js might imply react, both detected
    expect(stack.includes('next.js')).toBe(true);
    expect(stack.includes('react')).toBe(true);
  });

  it('is case-insensitive', () => {
    const html = '<script>window.REACT = {}</script>';
    expect(detectTechnologyStack(html)).toContain('react');
  });

  it('detects multiple frameworks', () => {
    const html = '<script src="/_next/main.js"></script><link href="/wp-content/style.css">';
    const stack = detectTechnologyStack(html);
    expect(stack).toContain('next.js');
    expect(stack).toContain('wordpress');
  });
});

// ── detectAntiScrapingSignals ─────────────────────────────────────────────────

describe('detectAntiScrapingSignals', () => {
  it('returns empty array for clean HTML', () => {
    expect(detectAntiScrapingSignals('<html><body>Normal page</body></html>')).toEqual([]);
  });

  it('detects 429 rate limit status code', () => {
    const signals = detectAntiScrapingSignals('', 429);
    expect(signals).toContain('http_429_rate_limit');
  });

  it('detects captcha keyword', () => {
    const html = '<div class="g-recaptcha" data-sitekey="abc">captcha</div>';
    expect(detectAntiScrapingSignals(html)).toContain('captcha');
  });

  it('detects cloudflare challenge from cf-chl', () => {
    const html = '<div class="cf-chl-widget">challenge</div>';
    expect(detectAntiScrapingSignals(html)).toContain('cloudflare_challenge');
  });

  it('detects cloudflare from "just a moment" text', () => {
    const html = '<h1>Just a moment...</h1>';
    expect(detectAntiScrapingSignals(html)).toContain('cloudflare_challenge');
  });

  it('detects cloudflare keyword', () => {
    const html = '<p>Protected by Cloudflare</p>';
    expect(detectAntiScrapingSignals(html)).toContain('cloudflare_challenge');
  });

  it('detects datadome', () => {
    const html = '<script src="//geo.captcha-delivery.com/captcha/?initialCid=datadome"></script>';
    expect(detectAntiScrapingSignals(html)).toContain('datadome');
  });

  it('detects perimeterx', () => {
    const html = '<div id="px-captcha"></div><script>_px.perimeterx</script>';
    expect(detectAntiScrapingSignals(html)).toContain('perimeterx');
  });

  it('detects hcaptcha', () => {
    const html = '<div class="h-captcha" data-sitekey="abc">hcaptcha</div>';
    expect(detectAntiScrapingSignals(html)).toContain('hcaptcha');
  });

  it('detects recaptcha', () => {
    const html = '<div class="g-recaptcha">recaptcha</div>';
    expect(detectAntiScrapingSignals(html)).toContain('recaptcha');
  });

  it('detects access denied', () => {
    const html = '<h1>Access Denied</h1>';
    expect(detectAntiScrapingSignals(html)).toContain('access_denied');
  });

  it('detects forbidden', () => {
    const html = '<p>403 Forbidden</p>';
    expect(detectAntiScrapingSignals(html)).toContain('access_denied');
  });

  it('detects bot detection message', () => {
    const html = '<p>Bot detection enabled — automated requests are blocked.</p>';
    expect(detectAntiScrapingSignals(html)).toContain('bot_detection_message');
  });

  it('returns sorted results', () => {
    const html = 'cloudflare captcha access denied';
    const signals = detectAntiScrapingSignals(html);
    const sorted = [...signals].sort();
    expect(signals).toEqual(sorted);
  });

  it('returns multiple signals', () => {
    const html = 'Just a moment... captcha verify';
    const signals = detectAntiScrapingSignals(html);
    expect(signals.length).toBeGreaterThan(1);
  });

  it('no signals for status 200 with clean HTML', () => {
    const signals = detectAntiScrapingSignals('<h1>Welcome</h1>', 200);
    expect(signals).toEqual([]);
  });
});

// ── detectRenderMode ──────────────────────────────────────────────────────────

describe('detectRenderMode', () => {
  it('returns unknown for empty HTML', () => {
    expect(detectRenderMode([], false, '')).toBe('unknown');
    expect(detectRenderMode([], false, '   ')).toBe('unknown');
  });

  it('returns client when appearsJsOnly is true', () => {
    expect(detectRenderMode([], true, '<html><body></body></html>')).toBe('client');
  });

  it('returns hybrid for next.js with __next_data__', () => {
    const html = '<script id="__NEXT_DATA__">{"props":{}}</script>';
    expect(detectRenderMode(['next.js', 'react'], false, html)).toBe('hybrid');
  });

  it('returns hybrid for react-based stack even without inline data', () => {
    const html = '<div data-reactroot><p>Content</p></div>';
    expect(detectRenderMode(['react'], false, html)).toBe('hybrid');
  });

  it('returns hybrid for nuxt stack', () => {
    const html = '<div id="__nuxt">Content here</div>';
    expect(detectRenderMode(['nuxt'], false, html)).toBe('hybrid');
  });

  it('returns server for plain HTML with no SPA stack', () => {
    const html = '<html><body><h1>Property Listing</h1><p>Details...</p></body></html>';
    expect(detectRenderMode(['wordpress'], false, html)).toBe('server');
  });

  it('returns server for astro stack', () => {
    const html = '<html><body><h1>Listing</h1></body></html>';
    expect(detectRenderMode(['astro'], false, html)).toBe('server');
  });

  it('returns hybrid for html with __initial_state__', () => {
    const html = '<script>window.__initial_state__ = {};</script><p>content</p>';
    expect(detectRenderMode(['react'], false, html)).toBe('hybrid');
  });
});

// ── buildBetterHtmlHint ───────────────────────────────────────────────────────

describe('buildBetterHtmlHint', () => {
  const baseParams = {
    sourceType: 'url_fetch' as const,
    appearsJsOnly: false,
    appearsBlocked: false,
    antiScrapingSignals: [] as string[],
  };

  it('returns not-suggested for clean url_fetch with good extraction', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      extractionRate: 0.8,
      populatedExtractableFields: 10,
      extractableFields: 15,
    });
    expect(hint.suggested).toBe(false);
    expect(hint.reasons).toHaveLength(0);
    expect(hint.suggestedActions).toHaveLength(0);
  });

  it('suggests when html appears JS-only from url_fetch', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      appearsJsOnly: true,
    });
    expect(hint.suggested).toBe(true);
    expect(hint.reasons.some(r => r.includes('JavaScript shell'))).toBe(true);
    expect(hint.suggestedActions.length).toBeGreaterThan(0);
  });

  it('suggests when blocked signals detected from url_fetch', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      appearsBlocked: true,
      antiScrapingSignals: ['cloudflare_challenge'],
    });
    expect(hint.suggested).toBe(true);
    expect(hint.reasons.some(r => r.includes('Bot-protection'))).toBe(true);
  });

  it('suggests when extraction rate is low with url_fetch', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      extractionRate: 0.3,
      extractableFields: 10,
    });
    expect(hint.suggested).toBe(true);
    expect(hint.reasons.some(r => r.includes('low'))).toBe(true);
  });

  it('does NOT suggest for low extraction rate when extractableFields <= 5', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      extractionRate: 0.2,
      extractableFields: 4,
    });
    // Low rate alone not enough when few fields
    expect(hint.suggested).toBe(false);
  });

  it('suggests when no fields extracted but fields are available', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      populatedExtractableFields: 0,
      extractableFields: 8,
    });
    expect(hint.suggested).toBe(true);
    expect(hint.reasons.some(r => r.includes('No extractable fields'))).toBe(true);
  });

  it('does NOT suggest when source is manual_html even with JS-only signals', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      sourceType: 'manual_html',
      appearsJsOnly: true,
    });
    // fromUrlFetch is false, so suggestion is suppressed
    expect(hint.suggested).toBe(false);
    // Reasons are still recorded
    expect(hint.reasons.length).toBeGreaterThan(0);
  });

  it('includes recommendation text for suggested hint', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      appearsJsOnly: true,
    });
    expect(hint.recommendation).toContain('Capture');
  });

  it('includes non-suggestion recommendation when not suggested', () => {
    const hint = buildBetterHtmlHint(baseParams);
    expect(hint.recommendation).toContain('sufficient');
  });

  it('includes multiple reasons when multiple issues present', () => {
    const hint = buildBetterHtmlHint({
      ...baseParams,
      appearsJsOnly: true,
      appearsBlocked: true,
    });
    expect(hint.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
