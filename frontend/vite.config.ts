/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { cspNoncePlugin } from './vite-plugins/csp-nonce';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000';
const manualChunkGroups: Record<string, string[]> = {
  'ag-grid': ['ag-grid-community', 'ag-grid-react'],
  antd: ['antd', '@ant-design/icons'],
  calendar: ['react-day-picker'],
  charts: ['recharts'],
  drawer: ['vaul'],
  forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
  motion: ['motion'],
  query: ['@tanstack/react-query'],
  echarts: ['echarts'],
  ui: ['lucide-react', '@radix-ui/react-alert-dialog', '@radix-ui/react-accordion', '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-collapsible', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-progress', '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-switch', '@radix-ui/react-slot', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
  vendor: ['react', 'react-dom', 'react-router-dom']
};
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }
  const normalized = id.replace(/\\/g, '/');
  for (const [chunk, packages] of Object.entries(manualChunkGroups)) {
    if (packages.some(packageName => normalized.includes(`/node_modules/${packageName}/`))) {
      return chunk;
    }
  }
  return 'vendor';
}
export default defineConfig({
  plugins: [react(), tailwindcss(), cspNoncePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true
      },
      '/sanctum': {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  },
  test: {
    projects: [{
      extends: true,
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
        exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
        testTimeout: 15_000
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
