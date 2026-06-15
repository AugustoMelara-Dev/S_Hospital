import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { cspNoncePlugin } from './vite-plugins/csp-nonce';

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000';

const manualChunkGroups: Record<string, string[]> = {
  charts: ['recharts'],
  forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
  query: ['@tanstack/react-query'],
  ui: [
    'lucide-react',
    '@radix-ui/react-alert-dialog',
    '@radix-ui/react-avatar',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-popover',
    '@radix-ui/react-scroll-area',
    '@radix-ui/react-select',
    '@radix-ui/react-separator',
    '@radix-ui/react-slot',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
  ],
  vendor: ['react', 'react-dom', 'react-router-dom'],
};

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  const normalized = id.replace(/\\/g, '/');

  for (const [chunk, packages] of Object.entries(manualChunkGroups)) {
    if (packages.some((packageName) => normalized.includes(`/node_modules/${packageName}/`))) {
      return chunk;
    }
  }

  return 'vendor';
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspNoncePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/sanctum': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    testTimeout: 15_000,
  },
});
