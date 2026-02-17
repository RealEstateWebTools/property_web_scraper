/**
 * Tests for price-history — snapshot recording, dedup, and change detection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordSnapshot,
  getHistory,
  getPriceChanges,
  canonicalizeUrl,
  clearPriceHistory,
  type ExtractionData,
} from '../../src/lib/services/price-history.js';

beforeEach(() => {
  clearPriceHistory();
});

describe('canonicalizeUrl', () => {
  it('strips protocol and www', () => {
    expect(canonicalizeUrl('https://www.rightmove.co.uk/properties/123')).toBe(
      'rightmove.co.uk/properties/123',
    );
  });

  it('strips trailing slash', () => {
    expect(canonicalizeUrl('https://example.com/listing/456/')).toBe(
      'example.com/listing/456',
    );
  });

  it('lowercases', () => {
    expect(canonicalizeUrl('https://Example.COM/Listing/789')).toBe(
      'example.com/Listing/789'.toLowerCase(),
    );
  });

  it('preserves query params', () => {
    expect(canonicalizeUrl('https://example.com/listing?id=123')).toBe(
      'example.com/listing?id=123',
    );
  });

  it('handles bare domain', () => {
    expect(canonicalizeUrl('https://example.com')).toBe('example.com/');
  });
});

describe('recordSnapshot', () => {
  it('records a snapshot with price data', async () => {
    const snap = await recordSnapshot({
      url: 'https://www.rightmove.co.uk/properties/123',
      scraper: 'uk_rightmove',
      price_float: 250000,
      price_string: '£250,000',
      price_currency: 'GBP',
      quality_grade: 'A',
      title: 'Nice flat',
    });
    expect(snap).not.toBeNull();
    expect(snap!.price_float).toBe(250000);
    expect(snap!.scraper).toBe('uk_rightmove');
    expect(snap!.timestamp).toBeTruthy();
  });

  it('returns null when no price data', async () => {
    const snap = await recordSnapshot({
      url: 'https://example.com/123',
      scraper: 'test',
    });
    expect(snap).toBeNull();
  });

  it('skips recording when price is unchanged', async () => {
    const data: ExtractionData = {
      url: 'https://example.com/123',
      scraper: 'test',
      price_float: 100000,
      price_string: '£100,000',
    };

    const first = await recordSnapshot(data);
    expect(first).not.toBeNull();

    const second = await recordSnapshot(data);
    expect(second).toBeNull(); // Same price — should skip
  });

  it('records when price changes', async () => {
    await recordSnapshot({
      url: 'https://example.com/123',
      scraper: 'test',
      price_float: 100000,
      price_string: '£100,000',
    });

    const updated = await recordSnapshot({
      url: 'https://example.com/123',
      scraper: 'test',
      price_float: 95000,
      price_string: '£95,000',
    });
    expect(updated).not.toBeNull();
    expect(updated!.price_float).toBe(95000);
  });
});

describe('getHistory', () => {
  it('returns snapshots newest first', async () => {
    await recordSnapshot({
      url: 'https://example.com/123',
      scraper: 'test',
      price_float: 100000,
      price_string: '£100,000',
    });
    await recordSnapshot({
      url: 'https://example.com/123',
      scraper: 'test',
      price_float: 95000,
      price_string: '£95,000',
    });

    const history = await getHistory('https://example.com/123');
    expect(history.snapshot_count).toBe(2);
    expect(history.snapshots[0].price_float).toBe(95000);
    expect(history.snapshots[1].price_float).toBe(100000);
  });

  it('respects limit parameter', async () => {
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 100, price_string: '100' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 200, price_string: '200' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 300, price_string: '300' });

    const history = await getHistory('https://example.com/1', 2);
    expect(history.snapshot_count).toBe(2);
  });

  it('returns empty for unknown URL', async () => {
    const history = await getHistory('https://unknown.com/listing');
    expect(history.snapshot_count).toBe(0);
    expect(history.snapshots).toHaveLength(0);
  });

  it('normalizes URL variants to same history', async () => {
    await recordSnapshot({
      url: 'https://www.example.com/listing/123/',
      scraper: 'test',
      price_float: 100000,
      price_string: '100k',
    });

    const history = await getHistory('https://example.com/listing/123');
    expect(history.snapshot_count).toBe(1);
  });
});

describe('getPriceChanges', () => {
  it('detects price reduction', async () => {
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 200000, price_string: '200k' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 180000, price_string: '180k' });

    const changes = await getPriceChanges('https://example.com/1');
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('down');
    expect(changes[0].change_amount).toBe(-20000);
    expect(changes[0].change_percent).toBe(-10);
  });

  it('detects price increase', async () => {
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 100000, price_string: '100k' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 110000, price_string: '110k' });

    const changes = await getPriceChanges('https://example.com/1');
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('up');
    expect(changes[0].change_amount).toBe(10000);
    expect(changes[0].change_percent).toBe(10);
  });

  it('returns empty for single snapshot', async () => {
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 100000, price_string: '100k' });
    const changes = await getPriceChanges('https://example.com/1');
    expect(changes).toHaveLength(0);
  });

  it('returns empty for no history', async () => {
    const changes = await getPriceChanges('https://unknown.com/listing');
    expect(changes).toHaveLength(0);
  });

  it('handles multiple price changes', async () => {
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 300000, price_string: '300k' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 280000, price_string: '280k' });
    await recordSnapshot({ url: 'https://example.com/1', scraper: 'test', price_float: 275000, price_string: '275k' });

    const changes = await getPriceChanges('https://example.com/1');
    expect(changes).toHaveLength(2);
    // Newest change first
    expect(changes[0].from.price_float).toBe(280000);
    expect(changes[0].to.price_float).toBe(275000);
    expect(changes[1].from.price_float).toBe(300000);
    expect(changes[1].to.price_float).toBe(280000);
  });
});
