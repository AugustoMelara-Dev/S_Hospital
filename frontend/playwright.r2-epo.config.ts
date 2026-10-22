import { defineConfig } from '@playwright/test';

// EPO-PER-LINE-QA — runner acotado y propio de hs-qa para el recorrido EPO.
//
// Usa el fixture `request` (APIRequestContext), NO un navegador: el entorno
// tenia ~464 MB libres y Chromium abortaba con "VirtualAlloc failed"; el
// backend y MariaDB de laboratorio si estan estables. La parte puramente
// visual queda delegada a hs-ux y declarada NOT VERIFIED.
//
// Requiere el laboratorio en 127.0.0.1:15173 (Vite proxy -> backend 18080).
const baseURL = process.env.R2_EPO_BASE_URL ?? 'http://127.0.0.1:15173';

export default defineConfig({
  testDir: './qa-e2e',
  testMatch: /r2-epo-qa\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL },
});
