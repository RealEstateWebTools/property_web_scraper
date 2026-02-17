import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://localhost:4327',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4327',
    port: 4327,
    reuseExistingServer: !!process.env.CI,
    env: {
      ...process.env,
      PWS_API_KEY: '',
      PWS_ADMIN_KEY: '',
    },
  },
});
