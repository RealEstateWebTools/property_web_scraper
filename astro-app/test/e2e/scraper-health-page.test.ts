import { test, expect } from '@playwright/test';

test.describe('Scraper health page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scraper-health');
  });

  test('has correct title and summary copy', async ({ page }) => {
    await expect(page).toHaveTitle(/Scraper Health/);
    await expect(page.getByText('How to read this page', { exact: true })).toBeVisible();
    await expect(page.getByText('fixture-based quality snapshot', { exact: false })).toBeVisible();
  });

  test('shows summary cards and public API link', async ({ page }) => {
    await expect(page.getByText('Scrapers tracked', { exact: true })).toBeVisible();
    await expect(page.getByText('Fixture coverage', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open JSON feed' })).toBeVisible();
  });

  test('renders scraper rows', async ({ page }) => {
    await expect(page.locator('text=uk_rightmove').first()).toBeVisible();
    await expect(page.locator('text=es_idealista').first()).toBeVisible();
  });
});