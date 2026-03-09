import { test, expect } from '@playwright/test';

test.describe('Supported sites page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sites');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Supported Sites/);
  });

  test('renders site cards with names', async ({ page }) => {
    await expect(page.locator('h5', { hasText: 'es_idealista' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'uk_rightmove' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'uk_zoopla' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'us_realtor' })).toBeVisible();
  });

  test('each site card shows hostname', async ({ page }) => {
    await expect(page.locator('p', { hasText: 'idealista.com' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'rightmove.co.uk' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'zoopla.co.uk' })).toBeVisible();
  });

  test('each site card shows country badge', async ({ page }) => {
    await expect(page.locator('span', { hasText: 'Spain' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'United Kingdom' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'United States' }).first()).toBeVisible();
    await expect(page.locator('span', { hasText: /^India$/ }).first()).toBeVisible();
  });

  test('page renders many extract buttons linked to /extract/url', async ({ page }) => {
    const extractButtons = page.locator('.grid a[href="/extract/url"]');
    expect(await extractButtons.count()).toBeGreaterThan(50);
  });

  test('summary cards show overall coverage', async ({ page }) => {
    await expect(page.getByText('Named portals', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Countries covered', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Manual HTML required', { exact: true }).first()).toBeVisible();
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
