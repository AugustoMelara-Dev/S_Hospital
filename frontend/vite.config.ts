/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { cspNoncePlugin } from './vite-plugins/csp-nonce';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const dependenciesRoot = realpathSync(path.resolve(dirname, 'node_modules'));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000';
export default defineConfig({
  plugins: [react(), tailwindcss(), cspNoncePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['aria-query', 'lz-string', 'pretty-format'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [dirname, dependenciesRoot],
      strict: true,
      deny: ['/.env', '/.env.*', '/.*', '/.git/**', '/qa/**']
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true
      },
      '/sanctum': {
        target: apiProxyTarget,
        changeOrigin: true
      }
    },
    middlewareMode: false
  },
  plugins: [react(), tailwindcss(), cspNoncePlugin(), {
    name: 's-hospital-block-internal-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ? req.url.split('?')[0] : '';
        if (raw === '/qa' || raw.startsWith('/qa/')) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        next();
      });
    }
  }],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-core',
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'react-router',
              test: /node_modules[\\/]react-router(?:-dom)?[\\/]/,
            },
            {
              name: 'radix-ui',
              test: /node_modules[\\/](?:radix-ui|@radix-ui)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    projects: [{
      extends: true,
      test: {
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
        maxWorkers: 4,
        pool: 'forks',
        sequence: { groupOrder: 0 },
        testTimeout: 30_000
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        sequence: { groupOrder: 1 },
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});
