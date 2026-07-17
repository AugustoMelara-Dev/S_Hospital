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
      'node_modules/**',
      'dist/**',
      'e2e/**',
      'scripts/mock-e2e-plan.test.mjs',
      'scripts/segmented-tests-lib.test.mjs',
    ],
    maxWorkers: 2,
    pool: 'forks',
    fileParallelism: true,
    testTimeout: 30_000,
  },
});
