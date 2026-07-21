import { defineConfig, devices } from '@playwright/test';

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  testMatch: /(real-smoke|critical-lan-performance)\.spec\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  // Real authentication rotates other sessions for the same operator. Keep
  // these infrastructure tests serial so they never invalidate one another.
  workers: 1,
  reporter: [['list']],
  use: {
    launchOptions: chromiumExecutablePath
      ? {
          executablePath: chromiumExecutablePath,
          args: ['--no-sandbox'],
        }
      : undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'real-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
