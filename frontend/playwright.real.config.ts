import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /real-smoke\.spec\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'real-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
