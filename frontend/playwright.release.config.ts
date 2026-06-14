import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_RELEASE_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './e2e',
  testMatch: /release-gate\.spec\.ts/,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/release-e2e-playwright.json' }],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'release-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
