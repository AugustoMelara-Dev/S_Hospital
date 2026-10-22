import { defineConfig, devices } from '@playwright/test';

/**
 * C4-B2 — segunda tanda de recorridos de hs-qa tras el fix de csp-nonce.
 *
 *  - UN worker, UN navegador (chromium), sin arrancar servidores:
 *    apunta a Vite :15173 y Laravel :18080 ya vivos.
 *  - Sin `route.fulfill` para endpoints de producto: clics reales; la API
 *    (GET) sólo prepara condiciones y verifica resultados.
 *  - Evidencia en `hospital-ai/evidencia/C4-B2` (override: C4B_EVIDENCE_DIR).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:15173';

export default defineConfig({
  testDir: './qa-e2e',
  testMatch: /c4b2-walkthroughs\.spec\.ts/,
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
