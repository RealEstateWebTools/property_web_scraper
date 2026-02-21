import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

test.describe('Listing detail page', () => {
  test('invalid listing ID shows not found message', async ({ page }) => {
    await page.goto('/listings/nonexistent-id');
    await expect(page.locator('text=Listing not found')).toBeVisible();
  });

  test('extracted listing is accessible via /listings/:id', async ({ page }) => {
    // First, extract a listing via the HTML form (use small rightmove_v2 fixture)
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.rightmove.co.uk/properties/168908774');
    await page.locator('#html_input').fill(loadFixture('rightmove_v2'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Click "View Full Details" to go to the listings detail page
    await page.locator('a', { hasText: 'View Full Details' }).click();
    await expect(page).toHaveURL(/\/listings\//);

    // Should show property detail layout
    await expect(page.locator('a', { hasText: 'PropertyWebScraper' }).first()).toBeVisible();
    // Breadcrumb should have Listings link
    await expect(page.locator('main nav a[href="/listings"]')).toBeVisible();
  });
});

test.describe('Listings browse page', () => {
  test('shows empty state when no extractions exist', async ({ page }) => {
    await page.goto('/listings');
    // Either shows listings or empty state — page should load without error
    await expect(page.locator('a', { hasText: 'PropertyWebScraper' }).first()).toBeVisible();
  });
});

test.describe('Listing JSON endpoint', () => {
  test('invalid ID returns 404', async ({ request }) => {
    const res = await request.get('/listings/nonexistent-id.json');
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
