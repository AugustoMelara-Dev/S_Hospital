import { defineConfig, devices } from '@playwright/test';

// MONEY-EXACTNESS-QA — runner acotado y propio de hs-qa (API-only, sin UI).
// testDir apunta a ./qa-e2e (fuera del testDir compartido ./e2e) para que
// ninguna corrida existente del proyecto lo recoja por accidente.
// Requiere el laboratorio ya arriba en 127.0.0.1:15173 (backend 18080).
const baseURL = process.env.R2_MONEY_BASE_URL ?? 'http://127.0.0.1:15173';

export default defineConfig({
  testDir: './qa-e2e',
  testMatch: /r2-money-qa\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'money-exactness-chromium', use: { ...devices['Desktop Chrome'] } }],
});
