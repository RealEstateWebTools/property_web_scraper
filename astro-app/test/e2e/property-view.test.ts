import { test, expect } from '@playwright/test';

test.describe('Single property view', () => {
  test('without url param shows error "Please provide a url"', async ({ page }) => {
    await page.goto('/single_property_view');
    await expect(page.locator('text=Please provide a url')).toBeVisible();
  });

  test('with unsupported URL shows error card', async ({ page }) => {
    await page.goto('/single_property_view?url=https://www.unknown-site.com/property/1');
    await expect(page.locator('text=Could not load property')).toBeVisible();
  });

  test('with supported URL loads without 500 (Firestore fallback works)', async ({ page }) => {
    const response = await page.goto('/single_property_view?url=https://www.idealista.com/inmueble/12345/');
    // Should not be a server error
    expect(response!.status()).toBeLessThan(500);

    // Page should show property detail layout (not an error)
    // Since no HTML was provided, listing will be mostly empty but page should still render
    await expect(page.locator('a', { hasText: 'PropertyWebScraper' }).first()).toBeVisible();
  });
});
