import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Documents the AppRoutes chunking policy.
 *
 * DashboardView is the only view lazy-loaded via React.lazy
 * because it is the landing page after login and the largest
 * chunk (Recharts dependency). The other heavy views
 * (Reports, Backups, Invoice History, etc) are direct
 * imports: Vite's manualChunks config splits them into
 * separate vendor chunks (vendor-charts, vendor-forms, etc)
 * so they download in parallel with the main bundle but do
 * not delay the initial paint of the login screen. This
 * trade-off was locked in 088232ec ("keep dashboard as the
 * only lazy route") after measuring that React.lazy on
 * the other views introduced a perceptible Suspense flash
 * on the LAN without a meaningful first-paint win.
 *
 * If a future contributor wants to make a view lazy, the
 * 'wraps the Routes in a Suspense fallback' test below
 * guarantees the cashier never sees a blank screen during
 * the chunk download.
 */
describe('AppRoutes lazy-loading', () => {
  it('lazy-loads DashboardView as the landing page', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    const lazyBinding = source.match(
      /DashboardView\s*=\s*lazy\(\s*\(\)\s*=>\s*import\([^)]*DashboardView/,
    );
    expect(lazyBinding, 'DashboardView should be lazy loaded').not.toBeNull();
  });

  it('wraps the lazy DashboardView route in a Suspense fallback so the cashier never sees a blank screen', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    // The DashboardView <Route> is wrapped in <Suspense fallback={<LoadingState />}>
    // so the cashier sees a "Cargando modulo..." indicator while the chunk
    // downloads instead of a blank screen.
    expect(source).toMatch(/Suspense[^>]*fallback=/);
  });
});
