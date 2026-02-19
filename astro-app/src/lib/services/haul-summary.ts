/**
 * Pure function to compute summary statistics from haul scrapes.
 */

import type { HaulScrape } from './haul-store.js';

export interface HaulSummary {
  priceRange: { min: number; max: number; currency: string } | null;
  avgPrice: number | null;
  medianPrice: number | null;
  gradeDistribution: Record<string, number>;
  portalCounts: Record<string, number>;
  bedroomRange: { min: number; max: number } | null;
  cityDistribution: Record<string, number>;
  scrapesWithGeo: number;
  totalScrapes: number;
}

export function computeHaulSummary(scrapes: HaulScrape[]): HaulSummary {
  const summary: HaulSummary = {
    priceRange: null,
    avgPrice: null,
    medianPrice: null,
    gradeDistribution: {},
    portalCounts: {},
    bedroomRange: null,
    cityDistribution: {},
    scrapesWithGeo: 0,
    totalScrapes: scrapes.length,
  };

  if (scrapes.length === 0) return summary;

  // Price stats
  const prices = scrapes
    .map((s) => s.price_float)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  if (prices.length > 0) {
    prices.sort((a, b) => a - b);
    const currency = scrapes.find((s) => s.currency)?.currency || '';
    summary.priceRange = { min: prices[0], max: prices[prices.length - 1], currency };
    summary.avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
    const mid = Math.floor(prices.length / 2);
    summary.medianPrice = prices.length % 2 === 0
      ? Math.round((prices[mid - 1] + prices[mid]) / 2)
      : prices[mid];
  }

  // Grade distribution
  for (const s of scrapes) {
    const grade = s.grade || 'F';
    summary.gradeDistribution[grade] = (summary.gradeDistribution[grade] || 0) + 1;
  }

  // Portal counts
  for (const s of scrapes) {
    const slug = s.import_host_slug;
    if (slug) {
      summary.portalCounts[slug] = (summary.portalCounts[slug] || 0) + 1;
    }
  }

  // Bedroom range
  const bedrooms = scrapes
    .map((s) => s.count_bedrooms)
    .filter((b): b is number => typeof b === 'number' && b > 0);

  if (bedrooms.length > 0) {
    bedrooms.sort((a, b) => a - b);
    summary.bedroomRange = { min: bedrooms[0], max: bedrooms[bedrooms.length - 1] };
  }

  // City distribution
  for (const s of scrapes) {
    if (s.city) {
      summary.cityDistribution[s.city] = (summary.cityDistribution[s.city] || 0) + 1;
    }
  }

  // Geo count
  summary.scrapesWithGeo = scrapes.filter(
    (s) => s.latitude && s.longitude,
  ).length;

  return summary;
}
