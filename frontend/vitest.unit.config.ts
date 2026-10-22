import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['aria-query', 'lz-string', 'pretty-format'],
  },
  test: {
    name: 'unit',
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: [
      // Defaults de Vitest 4.1.x + especificos del proyecto. `qa-e2e/**` usa
      // `@playwright/test` y este runner tambien debe dejarlo fuera para no
      // romper `test:coverage` con una specs de Playwright.
      '**/node_modules/**',
      '**/.git/**',
      'dist/**',
      'e2e/**',
      'qa-e2e/**',
      'scripts/mock-e2e-plan.test.mjs',
      'scripts/segmented-tests-lib.test.mjs',
    ],
    maxWorkers: 2,
    pool: 'forks',
    fileParallelism: true,
    testTimeout: 30_000,
  },
});
