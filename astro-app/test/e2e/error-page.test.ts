import { test, expect } from '@playwright/test';

test.describe('Error page — not_real_estate', () => {
  test('shows red card with correct message', async ({ page }) => {
    await page.goto('/extract/error?reason=not_real_estate&url=https://www.youtube.com/watch');
    await expect(page.locator('text=doesn\'t look like a real estate website')).toBeVisible();
    await expect(page.locator('.bg-red-50')).toBeVisible();
    await expect(page.locator('text=youtube.com')).toBeVisible();
  });

  test('shows supported sites badges', async ({ page }) => {
    await page.goto('/extract/error?reason=not_real_estate');
    await expect(page.locator('text=idealista.com')).toBeVisible();
    await expect(page.locator('text=rightmove.co.uk')).toBeVisible();
  });

  test('has Try Again and View Supported Sites buttons', async ({ page }) => {
    await page.goto('/extract/error?reason=not_real_estate');
    await expect(page.locator('a[href="/extract/url"]', { hasText: 'Try Again' })).toBeVisible();
    await expect(page.locator('a[href="/sites"]', { hasText: 'Supported Sites' })).toBeVisible();
  });
});

test.describe('Error page — search_results', () => {
  test('shows amber card with search results message', async ({ page }) => {
    await page.goto('/extract/error?reason=search_results&url=https://www.rightmove.co.uk/property-for-sale/London.html');
    await expect(page.locator('text=Search results pages aren\'t supported')).toBeVisible();
    await expect(page.locator('.bg-amber-50')).toBeVisible();
  });

  test('shows example of correct vs incorrect URL', async ({ page }) => {
    await page.goto('/extract/error?reason=search_results');
    await expect(page.locator('text=single property listing')).toBeVisible();
  });
});

test.describe('Error page — unsupported / unknown_real_estate', () => {
  test('shows blue card for unknown real estate site', async ({ page }) => {
    await page.goto('/extract/error?reason=unknown_real_estate&url=https://www.example-realty.com/listing/1');
    await expect(page.locator('text=don\'t have a scraper for this site yet')).toBeVisible();
    await expect(page.locator('.bg-blue-50')).toBeVisible();
  });

  test('has Try Anyway, Paste HTML, and Back buttons', async ({ page }) => {
    await page.goto('/extract/error?reason=unknown_real_estate&url=https://www.example.com/listing/1');
    await expect(page.locator('button', { hasText: 'Try Anyway' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Paste HTML Instead' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Back' })).toBeVisible();
  });

  test('shows GitHub link for requesting site support', async ({ page }) => {
    await page.goto('/extract/error?reason=unsupported');
    await expect(page.locator('a[href*="github.com"]', { hasText: 'Request support' })).toBeVisible();
  });
});

test.describe('Error page — fetch_blocked', () => {
  test('shows amber card for fetch-blocked portal', async ({ page }) => {
    await page.goto('/extract/error?reason=fetch_blocked&url=https://www.realtor.com/listing/1&portal=realtor.com');
    await expect(page.locator('text=requires browser-rendered HTML')).toBeVisible();
    // Portal name appears in the description paragraph
    await expect(page.locator('p', { hasText: 'realtor.com' }).first()).toBeVisible();
  });

  test('has Paste HTML and Upload HTML buttons', async ({ page }) => {
    await page.goto('/extract/error?reason=fetch_blocked&url=https://example.com/1');
    await expect(page.locator('a', { hasText: 'Paste HTML' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Upload HTML File' })).toBeVisible();
  });
});

test.describe('Error page — missing_url', () => {
  test('shows amber card with missing URL message', async ({ page }) => {
    await page.goto('/extract/error?reason=missing_url');
    await expect(page.locator('text=No URL provided')).toBeVisible();
    await expect(page.locator('a[href="/extract/url"]', { hasText: 'Try Again' })).toBeVisible();
  });
});

test.describe('Error page — experimental', () => {
  test('shows blue card for experimental portal', async ({ page }) => {
    await page.goto('/extract/error?reason=experimental&url=https://www.example-portal.com/listing/1');
    await expect(page.locator('text=generic extraction')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Extract Anyway' })).toBeVisible();
  });
});

test.describe('Error page — generic error', () => {
  test('shows fallback card with custom message', async ({ page }) => {
    await page.goto('/extract/error?reason=error&message=Connection%20timed%20out');
    await expect(page.locator('text=Something went wrong')).toBeVisible();
    await expect(page.locator('text=Connection timed out')).toBeVisible();
  });

  test('shows default message when no message param', async ({ page }) => {
    await page.goto('/extract/error');
    await expect(page.locator('text=Something went wrong')).toBeVisible();
    await expect(page.locator('text=An unknown error occurred')).toBeVisible();
  });
});
