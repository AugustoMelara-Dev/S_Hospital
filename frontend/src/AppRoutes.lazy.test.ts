import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke test that guarantees the heavy routes stay lazy-loaded so the
 * cashier can land on /login and reach /dashboard without pulling the
 * Reports, Backups, Fiscal Settings or Invoice History chunks.
 */
describe('AppRoutes lazy-loading', () => {
  it('defines the heavy views through React.lazy', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    const heavyRoutes = [
      'AboutView',
      'BackupsView',
      'CatalogView',
      'DashboardView',
      'FiscalSettingsView',
      'HelpView',
      'InvoiceHistoryView',
      'ReportsView',
      'UsersView',
    ];

    for (const view of heavyRoutes) {
      const lazyBinding = source.match(new RegExp(`lazy\\(\\(\\) => import\\([^)]*${view}[^)]*\\)`));
      expect(lazyBinding, `Expected ${view} to be lazy-loaded`).not.toBeNull();
    }
  });

  it('wraps the Routes in a Suspense fallback so the cashier never sees a blank screen', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    expect(source).toMatch(/Suspense[^>]*fallback=/);
  });
});
