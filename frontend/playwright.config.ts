import { defineConfig, devices } from '@playwright/test';

const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: 'npm.cmd run dev -- --host 127.0.0.1',
        url: 'http://127.0.0.1:5173/login',
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
