import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync(resolve(__dirname, 'AppRoutes.tsx'), 'utf8');
const appSource = () => readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

/**
 * Garantiza que las vistas nuevas sigan cargándose con React.lazy y que el
 * entry de la aplicación no arrastre los módulos R2 retirados.
 */
describe('AppRoutes: carga diferida de la nueva base visual', () => {
  it('declara las vistas nuevas mediante React.lazy', () => {
    const routes = source();
    const views = [
      'ResumenView',
      'CobrarView',
      'RecibosView',
      'CajaView',
      'ReportesView',
      'AdministracionView',
    ];

    for (const view of views) {
      const lazyBinding = routes.match(new RegExp(`lazy\\(\\(\\)\\s*=>\\s*import\\([^)]*${view}[^)]*\\)`));
      expect(lazyBinding, `Se esperaba ${view} con React.lazy`).not.toBeNull();
    }
  });

  it('envuelve cada ruta diferida en Suspense con un fallback propio', () => {
    const routes = source();
    expect(routes).toMatch(/<Suspense fallback=\{<AdminRouteLoading/);
    expect(routes).not.toMatch(/Cargando módulo\.\.\./);
  });

  it('ya no importa las vistas R2 retiradas', () => {
    const routes = source();
    const retiredViews = [
      'DashboardView',
      'NewInvoiceView',
      'InvoiceHistoryView',
      'CashBoxView',
      'ReportsView',
      'CatalogView',
      'UsersView',
      'BackupsView',
      'FiscalSettingsView',
      'InstitutionalReceiptSettingsView',
      'AboutView',
      'HelpView',
      'SupportCenterView',
    ];

    for (const view of retiredViews) {
      expect(routes, `${view} no debe seguir registrada en AppRoutes`).not.toContain(view);
    }
  });

  it('declara los redirects de las rutas antiguas al destino nuevo', () => {
    const routes = source();

    expect(routes).toContain('<Route path="/dashboard" element={<Navigate to={adminRoutePaths.resumen} replace />} />');
    expect(routes).toContain('<Route path="/billing/new" element={<Navigate to={adminRoutePaths.cobrar} replace />} />');
    expect(routes).toContain('<Route path="/invoices" element={<Navigate to={adminRoutePaths.recibos} replace />} />');
    expect(routes).toContain('<Route path="/cashbox" element={<Navigate to={adminRoutePaths.caja} replace />} />');
    expect(routes).toContain('<Route path="/settings/*" element={<Navigate to={adminRoutePaths.administracionAjustes} replace />} />');
  });

  it('monta App con AdminShell y no con el shell R2', () => {
    const app = appSource();

    expect(app).toContain("from './shell/admin/AdminShell'");
    expect(app).toContain('<AdminShell');
    expect(app).not.toContain('InstitutionalShell');
    expect(app).not.toMatch(/import\s+\{\s*CashBoxView\s*\}/);
  });

  it('usa el estado no encontrado del componente admin en el wildcard', () => {
    expect(source()).toContain('<Route path="*" element={<AdminNotFound landing={landing} />} />');
  });
});
