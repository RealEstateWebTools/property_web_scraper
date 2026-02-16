import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

test.describe('Form submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('submitting empty URL is blocked by browser validation', async ({ page }) => {
    const urlInput = page.locator('#import_url');
    // The input has the "required" attribute
    await expect(urlInput).toHaveAttribute('required', '');

    // Attempt submit — the browser should block it (form won't actually submit)
    await page.locator('#submitBtn').click();

    // The results div should remain empty because the form was not submitted
    const results = page.locator('#retrieve-results');
    await expect(results).toBeEmpty();
  });

  test('submitting URL for unsupported site shows error card', async ({ page }) => {
    await page.locator('#import_url').fill('https://www.unsupported-site-xyz.com/listing/123');
    await page.locator('#submitBtn').click();

    const results = page.locator('#retrieve-results');
    await expect(results.locator('text=isn\'t supported yet')).toBeVisible({ timeout: 15000 });

    // Error card should list supported sites
    await expect(results.locator('text=idealista.com')).toBeVisible();
  });

  test('submitting with HTML mode extracts property data', async ({ page }) => {
    // Switch to HTML mode
    await page.locator('.pws-mode-tab[data-mode="html"]').click();

    // Fill URL
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');

    // Paste fixture HTML
    const fixtureHtml = loadFixture('idealista_2018_01');
    await page.locator('#html_input').fill(fixtureHtml);

    // Submit
    await page.locator('#submitBtn').click();

    // Wait for success card
    const results = page.locator('#retrieve-results');
    await expect(results.locator('text=Property data extracted successfully')).toBeVisible({ timeout: 30000 });

    // Title should appear
    await expect(results.locator('h5')).toContainText('Piso en venta en goya');

    // Price pill should appear
    await expect(results.locator('text=990.000 EUR')).toBeVisible();

    // "View Full Details" link should exist
    await expect(results.locator('a', { hasText: 'View Full Details' })).toBeVisible();
  });

  test('clicking "Show all extracted fields" reveals table', async ({ page }) => {
    // Switch to HTML mode and submit fixture
    await page.locator('.pws-mode-tab[data-mode="html"]').click();
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');
    await page.locator('#html_input').fill(loadFixture('idealista_2018_01'));
    await page.locator('#submitBtn').click();

    const results = page.locator('#retrieve-results');
    await expect(results.locator('text=Property data extracted successfully')).toBeVisible({ timeout: 30000 });

    // Details table should be hidden initially
    const allFields = results.locator('#all-fields');
    await expect(allFields).toBeHidden();

    // Click toggle
    await results.locator('.pws-details-toggle').click();
    await expect(allFields).toBeVisible();

    // Table should contain field rows
    await expect(allFields.locator('table')).toBeVisible();
  });

  test('success card shows image thumbnail when extraction finds images', async ({ page }) => {
    await page.locator('.pws-mode-tab[data-mode="html"]').click();
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');
    await page.locator('#html_input').fill(loadFixture('idealista_2018_01'));
    await page.locator('#submitBtn').click();

    const results = page.locator('#retrieve-results');
    await expect(results.locator('text=Property data extracted successfully')).toBeVisible({ timeout: 30000 });

    // The success card should render an image
    const img = results.locator('img[alt="Property image"]');
    await expect(img).toBeVisible();
  });
});
