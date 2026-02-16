import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Property Web Scraper');
  });

  test('hero section has dark gradient background', async ({ page }) => {
    const hero = page.locator('section').first();
    const bg = await hero.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('gradient');
  });

  test('hero has 3 CTA buttons linking to extract modes', async ({ page }) => {
    await expect(page.locator('a[href="/extract/html"]').first()).toBeVisible();
    await expect(page.locator('a[href="/extract/upload"]').first()).toBeVisible();
    await expect(page.locator('a[href="/extract/url"]').first()).toBeVisible();
  });

  test('supported sites section renders badges and link', async ({ page }) => {
    const siteBadges = page.locator('text=idealista.com');
    await expect(siteBadges.first()).toBeVisible();

    const viewAll = page.locator('a[href="/sites"]').first();
    await expect(viewAll).toBeVisible();
  });

  test('"How It Works" section has 3 step headings', async ({ page }) => {
    const heading = page.locator('h3', { hasText: 'How It Works' });
    await expect(heading).toBeVisible();

    const steps = page.locator('h5', { hasText: /Provide a Source|We Extract Data|Use the Results/ });
    await expect(steps).toHaveCount(3);
  });

  test('navbar has brand link, nav items, and GitHub link', async ({ page }) => {
    const brand = page.locator('nav a[href="/"]');
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('PropertyWebScraper');

    // Desktop nav (#navMenu) contains the links — use .first() to avoid mobile menu duplicates
    const desktopNav = page.locator('#navMenu');
    await expect(desktopNav.locator('a[href="/extract/url"]')).toBeVisible();
    await expect(desktopNav.locator('a[href="/listings"]')).toBeVisible();
    await expect(desktopNav.locator('a[href="/sites"]')).toBeVisible();
    await expect(desktopNav.locator('a[href="/docs/api"]')).toBeVisible();

    const github = page.locator('nav a[href*="github.com"]');
    await expect(github.first()).toBeVisible();
  });

  test('footer renders', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('PropertyWebScraper');
  });
});
