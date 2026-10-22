import { defineConfig, devices } from '@playwright/test';

/**
 * C4-B-UI-WALKTHROUGHS — runner acotado de hs-qa.
 *
 * Reglas de recursos del encargo:
 *  - UN worker, UN navegador (chromium).
 *  - No arranca servidor propio: apunta al Vite ya levantado en :15173 con
 *    `PLAYWRIGHT_EXTERNAL_SERVER=1` + `PLAYWRIGHT_BASE_URL`.
 *  - Nada de `npm run build` ni vitest.
 *
 * A diferencia de los runners con mock (`playwright.config.ts` + `e2e/`), este
 * spec NO usa `route.fulfill`: todos los datos provienen del backend Laravel +
 * MariaDB de laboratorio a traves del proxy de Vite.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:15173';

export default defineConfig({
  testDir: './qa-e2e',
  testMatch: /c4b-walkthroughs\.spec\.ts/,
  globalSetup: './qa-e2e/c4b-global-setup.ts',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
  ],
});
