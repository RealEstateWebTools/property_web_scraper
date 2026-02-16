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
    // The gradient uses dark colours (#1a1a2e, #16213e, #0f3460)
    expect(bg).toContain('gradient');
  });

  test('"Try It Now" button is visible and links to #try-it', async ({ page }) => {
    const cta = page.locator('a[href="#try-it"]');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('Try It Now');
  });

  test('3 mode tabs render with URL tab active by default', async ({ page }) => {
    const tabs = page.locator('.pws-mode-tab');
    await expect(tabs).toHaveCount(3);

    const urlTab = page.locator('.pws-mode-tab[data-mode="url"]');
    await expect(urlTab).toHaveClass(/bg-white/);
    await expect(urlTab).toHaveClass(/text-blue-600/);
  });

  test('clicking "Paste HTML" tab shows textarea', async ({ page }) => {
    const htmlTab = page.locator('.pws-mode-tab[data-mode="html"]');
    const htmlGroup = page.locator('#htmlGroup');

    await expect(htmlGroup).toBeHidden();
    await htmlTab.click();
    await expect(htmlGroup).toBeVisible();
    await expect(page.locator('#html_input')).toBeVisible();
  });

  test('clicking "Upload File" tab shows file input', async ({ page }) => {
    const fileTab = page.locator('.pws-mode-tab[data-mode="file"]');
    const fileGroup = page.locator('#fileGroup');

    await expect(fileGroup).toBeHidden();
    await fileTab.click();
    await expect(fileGroup).toBeVisible();
    await expect(page.locator('#html_file_input')).toBeVisible();
  });

  test('supported site badges render (at least 7 plus "+ more")', async ({ page }) => {
    const badges = page.locator('.pws-mode-tab').first().locator('..').locator('..').locator('..').locator('.border-t span');
    // Use a more direct selector for the site badges
    const siteBadges = page.locator('section#try-it span.rounded-full');
    const count = await siteBadges.count();
    // 7 sites + "+ more" = 8
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('"How It Works" section has 3 step headings', async ({ page }) => {
    const heading = page.locator('h3', { hasText: 'How It Works' });
    await expect(heading).toBeVisible();

    const steps = page.locator('h5', { hasText: /Provide a Source|We Extract Data|Use the Results/ });
    await expect(steps).toHaveCount(3);
  });

  test('navbar has brand link and GitHub link', async ({ page }) => {
    const brand = page.locator('nav a[href="/"]');
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('PropertyWebScraper');

    const github = page.locator('nav a[href*="github.com"]');
    await expect(github.first()).toBeVisible();
  });

  test('footer renders', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('PropertyWebScraper');
  });
});
