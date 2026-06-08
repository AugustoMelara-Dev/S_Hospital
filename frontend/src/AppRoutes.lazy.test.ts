import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Documents the AppRoutes chunking policy.
 *
 * Heavy authenticated views are lazy-loaded via React.lazy so the cashier
 * reaches the shell quickly after login and only downloads reports, users,
 * fiscal settings, invoice history or area-service screens when the role
 * actually opens them. Vite's manualChunks config still separates shared
 * vendor dependencies so repeated navigation remains stable on a LAN.
 *
 * The Suspense fallback guarantees operators see an institutional loading
 * state, not a blank screen, while a route chunk downloads.
 */
describe('AppRoutes lazy-loading', () => {
  it('lazy-loads heavy authenticated views', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    for (const viewName of [
      'DashboardView',
      'ReportsView',
      'FiscalSettingsView',
      'UsersView',
      'InvoiceHistoryView',
      'AreaPaidServicesView',
    ]) {
      const lazyBinding = source.match(
        new RegExp(`${viewName}\\s*=\\s*lazy\\(\\s*\\(\\)\\s*=>\\s*import\\([^)]*${viewName}`),
      );
      expect(lazyBinding, `${viewName} should be lazy loaded`).not.toBeNull();
    }
  });

  it('wraps routes in a Suspense fallback so the operator never sees a blank screen', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    expect(source).toContain('<Suspense fallback={<LoadingState label="Cargando módulo..." />}>');
    expect(source).toMatch(/<Suspense[^>]*>[\s\S]*<Routes>/);
  });
});
