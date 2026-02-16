import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

test.describe('Extract via URL form', () => {
  test('submitting empty URL is blocked by browser validation', async ({ page }) => {
    await page.goto('/extract/url');
    const urlInput = page.locator('#import_url');
    await expect(urlInput).toHaveAttribute('required', '');
  });

  test('submitting URL for unsupported site redirects to error page', async ({ page }) => {
    await page.goto('/extract/url');
    await page.locator('#import_url').fill('https://www.unsupported-site-xyz.com/listing/123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/error/);
    await expect(page.locator('text=isn\'t supported yet')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=idealista.com')).toBeVisible();
  });
});

test.describe('Extract via HTML paste form', () => {
  test('submitting with HTML extracts property data and redirects to results', async ({ page }) => {
    await page.goto('/extract/html');

    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');
    await page.locator('#html_input').fill(loadFixture('idealista_2018_01'));
    await page.locator('button[type="submit"]').click();

    // Should redirect to results page
    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });

    // Success card content
    await expect(page.locator('text=Property data extracted successfully')).toBeVisible();
    await expect(page.locator('h5')).toContainText('Piso en venta en goya');
    await expect(page.locator('text=990.000 EUR')).toBeVisible();

    // Action links point to new routes
    await expect(page.locator('a', { hasText: 'View Full Details' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Get JSON' })).toBeVisible();
  });

  test('clicking "Show all extracted fields" reveals table', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');
    await page.locator('#html_input').fill(loadFixture('idealista_2018_01'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });
    await expect(page.locator('text=Property data extracted successfully')).toBeVisible();

    const allFields = page.locator('#all-fields');
    await expect(allFields).toBeHidden();

    await page.locator('.pws-details-toggle').click();
    await expect(allFields).toBeVisible();
    await expect(allFields.locator('table')).toBeVisible();
  });

  test('results page shows property image when extraction finds images', async ({ page }) => {
    await page.goto('/extract/html');
    await page.locator('#import_url').fill('https://www.idealista.com/inmueble/38604738/');
    await page.locator('#html_input').fill(loadFixture('idealista_2018_01'));
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/extract\/results\//, { timeout: 30000 });
    await expect(page.locator('text=Property data extracted successfully')).toBeVisible();

    const img = page.locator('img[alt="Property image"]');
    await expect(img).toBeVisible();
  });
});

test.describe('Extract mode switcher', () => {
  test('URL page has mode tabs with URL active', async ({ page }) => {
    await page.goto('/extract/url');
    // Scope to main content to avoid matching navbar links
    const modeTabs = page.locator('main .bg-gray-100');
    const urlTab = modeTabs.locator('a[href="/extract/url"]');
    await expect(urlTab).toHaveClass(/bg-white/);
    await expect(urlTab).toHaveClass(/text-blue-600/);
  });

  test('HTML page has mode tabs with HTML active', async ({ page }) => {
    await page.goto('/extract/html');
    const modeTabs = page.locator('main .bg-gray-100');
    const htmlTab = modeTabs.locator('a[href="/extract/html"]');
    await expect(htmlTab).toHaveClass(/bg-white/);
    await expect(htmlTab).toHaveClass(/text-blue-600/);
  });

  test('Upload page has mode tabs with Upload active', async ({ page }) => {
    await page.goto('/extract/upload');
    const modeTabs = page.locator('main .bg-gray-100');
    const uploadTab = modeTabs.locator('a[href="/extract/upload"]');
    await expect(uploadTab).toHaveClass(/bg-white/);
    await expect(uploadTab).toHaveClass(/text-blue-600/);
  });
});
