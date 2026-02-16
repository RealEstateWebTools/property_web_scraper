import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

test.describe('Diagnostics flow via HTML paste', () => {
  test('rightmove HTML paste shows green banner with field count', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('http://www.rightmove.co.uk/property-to-rent/property-51775029.html');
    await page.locator('#html_input').fill(loadFixture('rightmove'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Green success banner should be visible
    const greenBanner = page.locator('.bg-green-100');
    await expect(greenBanner).toBeVisible();
    // Should show field count in "Extracted N/M fields using rightmove" format
    await expect(greenBanner).toContainText(/Extracted \d+\/\d+ fields using rightmove/);
  });

  test('empty HTML paste shows banner with low field count (defaults only)', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('http://www.rightmove.co.uk/property-to-rent/property-99999.html');
    await page.locator('#html_input').fill('<html><body></body></html>');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // defaultValues (country, area_unit, currency, etc.) still count as populated,
    // so populatedFields > 0 and the green banner shows even with empty HTML.
    // The field count will be low (only defaults), not the full count.
    const greenBanner = page.locator('.bg-green-100');
    await expect(greenBanner).toBeVisible();
    // Should mention rightmove scraper and show a low populated count
    await expect(greenBanner).toContainText(/Extracted \d+\/\d+ fields using rightmove/);
  });

  test('diagnostics panel is collapsible and shows field traces', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('http://www.rightmove.co.uk/property-to-rent/property-51775029.html');
    await page.locator('#html_input').fill(loadFixture('rightmove'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Diagnostics panel should exist but be hidden initially
    const diagPanel = page.locator('#diagnostics-panel');
    await expect(diagPanel).toBeHidden();

    // Click the toggle to expand it
    const diagToggle = page.locator('.pws-diag-toggle');
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
    await page.locator('#import_url').fill('http://www.rightmove.co.uk/property-to-rent/property-51775029.html');
    await page.locator('#html_input').fill(loadFixture('rightmove'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Extract the listing ID from the URL
    const url = page.url();
    const idMatch = url.match(/\/extract\/results\/([^/]+)/);
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
    expect(json.diagnostics.scraperName).toBe('rightmove');
    expect(json.diagnostics.fieldTraces).toBeInstanceOf(Array);
    expect(json.diagnostics.fieldTraces.length).toBeGreaterThan(0);
    expect(json.diagnostics.populatedFields).toBeGreaterThan(0);
    expect(json.diagnostics.totalFields).toBeGreaterThan(0);
  });

  test('GET /listings/:id.json has no diagnostics key when none stored', async ({ page, request }) => {
    // Extract via URL-only mode (no HTML) — this will produce no diagnostics
    await page.goto('/extract/url');
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/99999/');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to results page
    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    const url = page.url();
    const idMatch = url.match(/\/extract\/results\/([^/]+)/);
    expect(idMatch).not.toBeNull();
    const id = idMatch![1];

    const res = await request.get(`/listings/${id}.json`);
    expect(res.status()).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    // No diagnostics in URL-only mode
    expect(json.diagnostics).toBeUndefined();
  });
});
