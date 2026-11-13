import { defineConfig, devices } from '@playwright/test';

/**
 * Help Center screenshot tours (HC3). Not part of `pnpm e2e`: run against a stack pointed at a
 * fresh database seeded with `pnpm --filter @abdcshare/api seed:help-demo` — see docs/help/README.md.
 * The tours create their own demo data through the UI/API and write PNGs to docs/help/images/.
 */
export default defineConfig({
  testDir: './help',
  testMatch: /\.tour\.ts$/, // files run in name order and later tours reuse earlier data
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: require.resolve('./help/global-setup'),
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
  },
});
