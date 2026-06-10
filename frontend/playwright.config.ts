import { defineConfig, devices } from '@playwright/test';

const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/real-smoke.spec.ts'],
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
