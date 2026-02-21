/**
 * HTML content analysis utilities.
 * Pure functions for detecting technology stacks, anti-scraping signals,
 * render modes, and generating "better HTML" hints.
 *
 * Extracted from scrape-metadata.ts to reduce file size and improve cohesion.
 */

import type { ScrapeSourceType, RenderMode, BetterHtmlHint } from './scrape-metadata.js';

export function detectTechnologyStack(html: string): string[] {
  const lower = html.toLowerCase();
  const stack: string[] = [];

  if (lower.includes('__next_data__') || lower.includes('/_next/')) stack.push('next.js');
  if (lower.includes('react') || lower.includes('data-reactroot')) stack.push('react');
  if (lower.includes('__nuxt') || lower.includes('nuxt')) stack.push('nuxt');
  if (lower.includes('vue')) stack.push('vue');
  if (lower.includes('ng-version') || lower.includes('angular')) stack.push('angular');
  if (lower.includes('/_astro/')) stack.push('astro');
  if (lower.includes('wp-content') || lower.includes('wordpress')) stack.push('wordpress');
  if (lower.includes('shopify')) stack.push('shopify');

  return uniqueSorted(stack);
}

export function detectAntiScrapingSignals(html: string, statusCode?: number): string[] {
  const lower = html.toLowerCase();
  const signals: string[] = [];

  if (statusCode === 429) signals.push('http_429_rate_limit');
  if (lower.includes('captcha')) signals.push('captcha');
  if (lower.includes('cf-chl') || lower.includes('cloudflare') || lower.includes('just a moment')) signals.push('cloudflare_challenge');
  if (lower.includes('datadome')) signals.push('datadome');
  if (lower.includes('perimeterx')) signals.push('perimeterx');
  if (lower.includes('hcaptcha')) signals.push('hcaptcha');
  if (lower.includes('recaptcha')) signals.push('recaptcha');
  if (lower.includes('access denied') || lower.includes('forbidden')) signals.push('access_denied');
  if (lower.includes('bot detection') || lower.includes('automated requests')) signals.push('bot_detection_message');

  return uniqueSorted(signals);
}

export function detectRenderMode(stack: string[], appearsJsOnly: boolean, html: string): RenderMode {
  if (html.trim() === '') return 'unknown';
  if (appearsJsOnly) return 'client';
  const lower = html.toLowerCase();
  const likelyHydrated = stack.includes('next.js') || stack.includes('react') || stack.includes('nuxt');
  const hasLargeInlineData = lower.includes('__next_data__') || lower.includes('__initial_state__') || lower.includes('window.page_model');
  if (likelyHydrated && hasLargeInlineData) return 'hybrid';
  if (likelyHydrated) return 'hybrid';
  return 'server';
}

export function buildBetterHtmlHint(params: {
  sourceType: ScrapeSourceType;
  appearsJsOnly: boolean;
  appearsBlocked: boolean;
  extractionRate?: number;
  populatedExtractableFields?: number;
  extractableFields?: number;
  antiScrapingSignals: string[];
}): BetterHtmlHint {
  const reasons: string[] = [];

  if (params.appearsJsOnly) {
    reasons.push('The fetched page appears to be a JavaScript shell with little server-rendered content.');
  }
  if (params.appearsBlocked || params.antiScrapingSignals.length > 0) {
    reasons.push('Bot-protection or anti-scraping signals were detected in the source.');
  }
  if (
    typeof params.extractionRate === 'number' &&
    params.extractionRate < 0.5 &&
    (params.extractableFields || 0) > 5
  ) {
    reasons.push('Extraction quality is low for this scrape and could improve with richer HTML.');
  }
  if (
    typeof params.populatedExtractableFields === 'number' &&
    params.populatedExtractableFields === 0 &&
    (params.extractableFields || 0) > 0
  ) {
    reasons.push('No extractable fields were populated from this HTML source.');
  }

  const fromUrlFetch = params.sourceType === 'url_fetch';
  const shouldSuggest = fromUrlFetch && reasons.length > 0;

  return {
    suggested: shouldSuggest,
    reasons,
    recommendation: shouldSuggest
      ? 'Capture fully rendered HTML from your browser and re-run extraction.'
      : 'Current HTML source appears sufficient.',
    suggestedActions: shouldSuggest
      ? [
          'Use the browser helper in /docs/get-html to capture rendered HTML.',
          'Use "Paste HTML" or "Upload File" and rerun extraction.',
          'If blocked, try from a residential network or authenticated browser session.',
        ]
      : [],
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}
