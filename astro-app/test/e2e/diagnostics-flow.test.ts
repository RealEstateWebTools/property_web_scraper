import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

test.describe('Diagnostics flow via HTML paste', () => {
  test('rightmove HTML paste shows grade banner with field count', async ({ page }) => {
    await page.goto('/extract/html');
    // Use a proper single-listing URL (not /property-to-rent/ which triggers search_results screen)
    await page.locator('#import_url').fill('https://www.rightmove.co.uk/properties/168908774');
    await page.locator('#html_input').fill(loadFixture('rightmove_v2'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Grade banner should be visible with field count info
    // Format: "Grade X: Label — N/M fields (P%...)"
    const gradeBanner = page.locator('text=/Grade [A-F]:/');
    await expect(gradeBanner).toBeVisible();
    await expect(gradeBanner).toContainText(/\d+\/\d+ fields/);
  });

  test('empty HTML paste shows grade banner with low field count (defaults only)', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.rightmove.co.uk/properties/99999999');
    await page.locator('#html_input').fill('<html><body></body></html>');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Grade banner still shows even with empty HTML (defaults produce some fields)
    const gradeBanner = page.locator('text=/Grade [A-F]:/');
    await expect(gradeBanner).toBeVisible();
  });

  test('diagnostics panel is collapsible and shows field traces', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.rightmove.co.uk/properties/168908774');
    await page.locator('#html_input').fill(loadFixture('rightmove_v2'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Diagnostics panel should exist but be hidden initially
    const diagPanel = page.locator('#diagnostics-panel');
    await expect(diagPanel).toBeHidden();

    // Wait for client-side JS (DOMContentLoaded toggle handlers) to be ready
    await page.waitForLoadState('domcontentloaded');

    // Click the toggle to expand it
    const diagToggle = page.locator('.pws-diag-toggle').first();
    await expect(diagToggle).toBeVisible();
    await diagToggle.click();

    // Panel should now be visible
    await expect(diagPanel).toBeVisible();

    // Should contain a trace table with header columns
    const table = diagPanel.locator('table');
    await expect(table).toBeVisible();
    // Table should have rows (field traces)
    const rows = table.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe('Diagnostics via JSON endpoints', () => {
  test('GET /listings/:id.json returns diagnostics after extraction', async ({ page, request }) => {
    // First extract via HTML form to create a listing in the store
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.rightmove.co.uk/properties/168908774');
    await page.locator('#html_input').fill(loadFixture('rightmove_v2'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Extract the listing ID from the URL
    const url = page.url();
    const idMatch = url.match(/\/extract\/results\/([^/?]+)/);
    expect(idMatch).not.toBeNull();
    const id = idMatch![1];

    // GET the JSON endpoint
    const res = await request.get(`/listings/${id}.json`);
    expect(res.status()).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.listing).toBeDefined();
    expect(json.listing.title).toBeTruthy();

    // Diagnostics should be present
    expect(json.diagnostics).toBeDefined();
    expect(json.diagnostics.scraperName).toBe('uk_rightmove');
    expect(json.diagnostics.fieldTraces).toBeInstanceOf(Array);
    expect(json.diagnostics.fieldTraces.length).toBeGreaterThan(0);
    expect(json.diagnostics.populatedFields).toBeGreaterThan(0);
    expect(json.diagnostics.totalFields).toBeGreaterThan(0);
  });

  test('GET /listings/:id.json returns 404 for missing listing', async ({ request }) => {
    const res = await request.get('/listings/nonexistent-test-id.json');
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
