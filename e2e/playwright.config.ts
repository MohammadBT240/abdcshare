import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against an already-running stack (default http://localhost:3000; set E2E_BASE_URL).
 * One worker: specs share a database, so they run in order and clean up after themselves.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: require.resolve('./support/global-setup'),
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
});
