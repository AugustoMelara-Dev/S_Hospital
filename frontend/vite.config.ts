import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { cspNoncePlugin } from './vite-plugins/csp-nonce';

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000';

/**
 * Manual chunks strategy (v1.0.0.1):
 * - `vendor.router`   -> react-router-dom (always loaded)
 * - `vendor.query`     -> @tanstack/react-query (used by every view)
 * - `vendor.echo`      -> laravel-echo + pusher-js (loaded when WS is up)
 * - `vendor.charts`    -> recharts (only Dashboard / Reports)
 * - `vendor.forms`     -> RHF + zod + hookform/resolvers (forms only)
 * - `vendor.ui`        -> lucide-react + Radix primitives
 *
 * The split keeps the entry chunk below the 500 KB warning limit and isolates heavy
 * deps (recharts ~400 KB) to the views that need them.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), cspNoncePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor.router': ['react-router-dom'],
          'vendor.query': ['@tanstack/react-query'],
          'vendor.echo': ['laravel-echo', 'pusher-js'],
          'vendor.charts': ['recharts'],
          'vendor.forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor.ui': [
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
        },
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
  },
});
