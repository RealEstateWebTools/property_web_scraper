import { test, expect } from '@playwright/test';

test.describe('Supported sites page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sites');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Supported Sites/);
  });

  test('renders site cards with names', async ({ page }) => {
    // Check known sites appear as card headings
    await expect(page.locator('h5', { hasText: 'Idealista' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'Rightmove' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'Zoopla' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'Realtor.com' })).toBeVisible();
  });

  test('each site card shows hostname', async ({ page }) => {
    await expect(page.locator('p', { hasText: 'idealista.com' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'rightmove.co.uk' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'zoopla.co.uk' })).toBeVisible();
  });

  test('each site card shows country badge', async ({ page }) => {
    await expect(page.locator('span', { hasText: 'Spain' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'UK' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'USA' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: /^India$/ })).toBeVisible();
  });

  test('each site card has Extract button linking to /extract/url', async ({ page }) => {
    const extractButtons = page.locator('.grid a[href="/extract/url"]');
    await expect(extractButtons).toHaveCount(8);
  });

  test('"Need a different site?" section is visible', async ({ page }) => {
    await expect(page.locator('text=Need a different site?')).toBeVisible();
    await expect(page.locator('a', { hasText: 'See the docs on GitHub' })).toBeVisible();
  });

  test('breadcrumb navigation is present', async ({ page }) => {
    await expect(page.locator('nav a[href="/"]', { hasText: 'Home' })).toBeVisible();
    await expect(page.locator('text=Supported Sites').first()).toBeVisible();
  });
});
