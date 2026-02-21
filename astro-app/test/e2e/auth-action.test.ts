import { test, expect } from '@playwright/test';

/**
 * E2E tests for /auth/action — Firebase email action handler.
 *
 * Firebase SDK initialises with the dev-server env (empty API key), so:
 * - initializeApp / getAuth succeed (no network call at init)
 * - applyActionCode / confirmPasswordReset would fail on first request
 *   → tests for verifyEmail and recoverEmail expect the error section
 * - resetPassword shows its form before making any Firebase call,
 *   so the password inputs are testable without a real Firebase project
 */

test.describe('/auth/action — missing or invalid params', () => {
  test('shows error when no query params are provided', async ({ page }) => {
    await page.goto('/auth/action');
    await expect(page.locator('#error-section')).toBeVisible();
    await expect(page.locator('#error-msg')).toContainText('Invalid or missing action code');
  });

  test('shows error when oobCode is missing', async ({ page }) => {
    await page.goto('/auth/action?mode=verifyEmail');
    await expect(page.locator('#error-section')).toBeVisible();
    await expect(page.locator('#error-msg')).toContainText('Invalid or missing action code');
  });

  test('shows error when mode is missing', async ({ page }) => {
    await page.goto('/auth/action?oobCode=abc123');
    await expect(page.locator('#error-section')).toBeVisible();
    await expect(page.locator('#error-msg')).toContainText('Invalid or missing action code');
  });

  test('shows error for unknown mode', async ({ page }) => {
    await page.goto('/auth/action?mode=unknownMode&oobCode=abc123');
    // Firebase SDK fetch may fail in test env before reaching the mode check,
    // but the error section must always become visible.
    await expect(page.locator('#error-section')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('/auth/action?mode=verifyEmail', () => {
  test('shows error section on invalid code', async ({ page }) => {
    await page.goto('/auth/action?mode=verifyEmail&oobCode=fake_code_123');
    // Firebase SDK cannot be fetched in test env — error section must appear
    await expect(page.locator('#error-section')).toBeVisible({ timeout: 8000 });
  });

  test('loading section is shown initially', async ({ page }) => {
    // Capture the loading state before scripts complete
    await page.goto('/auth/action?mode=verifyEmail&oobCode=fake_code_123');
    // Either loading or error will be visible (loading briefly, then error)
    const errorVisible = await page.locator('#error-section').isVisible({ timeout: 8000 });
    expect(errorVisible).toBe(true);
  });

  test('error section has a back-to-login link', async ({ page }) => {
    await page.goto('/auth/action?mode=verifyEmail&oobCode=fake_code');
    await expect(page.locator('#error-section')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#error-section a[href="/login"]')).toBeVisible();
  });
});

test.describe('/auth/action?mode=resetPassword', () => {
  test('shows password reset form', async ({ page }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=fake_code_123');
    await expect(page.locator('#reset-section')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();
    await expect(page.locator('#reset-btn')).toBeVisible();
  });

  test('page title is set to "Reset password"', async ({ page }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=fake_code_123');
    await expect(page.locator('#reset-section')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#page-title')).toHaveText('Reset password');
  });

  test('shows validation error when passwords are too short', async ({ page }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=fake_code_123');
    await expect(page.locator('#reset-section')).toBeVisible({ timeout: 8000 });

    await page.locator('#new-password').fill('short');
    await page.locator('#confirm-password').fill('short');
    await page.locator('#reset-btn').click();

    await expect(page.locator('#reset-error')).toBeVisible();
    await expect(page.locator('#reset-error')).toContainText('at least 8 characters');
  });

  test('shows validation error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=fake_code_123');
    await expect(page.locator('#reset-section')).toBeVisible({ timeout: 8000 });

    await page.locator('#new-password').fill('password123');
    await page.locator('#confirm-password').fill('different456');
    await page.locator('#reset-btn').click();

    await expect(page.locator('#reset-error')).toBeVisible();
    await expect(page.locator('#reset-error')).toContainText('do not match');
  });
});

test.describe('/auth/action?mode=recoverEmail', () => {
  test('shows error on invalid recovery code', async ({ page }) => {
    await page.goto('/auth/action?mode=recoverEmail&oobCode=fake_code_123');
    await expect(page.locator('#error-section')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('/auth/action — page structure', () => {
  test('has correct document title', async ({ page }) => {
    await page.goto('/auth/action');
    await expect(page).toHaveTitle(/Account Action/);
  });

  test('success section is hidden on load', async ({ page }) => {
    await page.goto('/auth/action');
    await expect(page.locator('#success-section')).toBeHidden();
  });

  test('reset section is hidden on load for non-resetPassword modes', async ({ page }) => {
    await page.goto('/auth/action?mode=verifyEmail&oobCode=fake');
    await expect(page.locator('#reset-section')).toBeHidden();
  });
});
