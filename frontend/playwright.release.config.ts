import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_RELEASE_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  testMatch: /release-(gate|rbac)\.spec\.ts/,
  outputDir: 'test-results/release-e2e-artifacts',
  timeout: 90_000,
  workers: 1,
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
    launchOptions: chromiumExecutablePath
      ? {
          executablePath: chromiumExecutablePath,
          args: ['--no-sandbox'],
        }
      : undefined,
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
