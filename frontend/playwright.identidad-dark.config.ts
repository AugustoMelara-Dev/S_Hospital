import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));
const evidenceRoot = resolve(
  process.env.DARK_EVIDENCE_DIR ??
    process.env.AZB_EVIDENCE_DIR ??
    resolve(frontendRoot, '..', 'hospital-ai', 'evidencia', 'DARK-20261016'),
);

export default defineConfig({
  testDir: './e2e',
  testMatch: /identidad-dark-.*\.spec\.ts/,
  globalSetup: './e2e/identidad-dark-global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(evidenceRoot, 'qa-playwright-report.json') }],
  ],
  outputDir: resolve(evidenceRoot, 'qa-test-results'),
  use: {
    baseURL: process.env.DARK_BASE_URL ?? process.env.AZB_BASE_URL ?? 'http://127.0.0.1:15173',
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-real-backend',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
