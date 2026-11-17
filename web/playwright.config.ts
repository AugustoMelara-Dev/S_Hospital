import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite against the REAL API (no mocks).
 *
 *   npm run e2e              # starts API (fresh SQLite DB, port 8765) + Vite (port 5174)
 *   npm run e2e -- --headed  # watch it
 *
 * Specs share one database and run in file order (01-…, 02-…) with a single
 * worker. Set E2E_BASE_URL to run against servers you started yourself
 * (then nothing is started and the DB is not reset).
 */
const API_PORT = process.env.E2E_API_PORT ?? '8765';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5174';
const external = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${WEB_PORT}`,
    locale: 'es-HN',
    timezoneId: 'America/Tegucigalpa',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : [
        {
          command: 'node e2e/start-api.mjs',
          url: `http://127.0.0.1:${API_PORT}/api/health`,
          env: { E2E_API_PORT: API_PORT },
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
          url: `http://127.0.0.1:${WEB_PORT}`,
          env: { SHS_API_PROXY: `http://127.0.0.1:${API_PORT}` },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
