import { describe, expect, it } from 'vitest';
import { getBreadcrumbs } from './AppShell';

describe('getBreadcrumbs', () => {
  it('uses institutional labels for operational routes', () => {
    expect(getBreadcrumbs('/backups').map((crumb) => crumb.label)).toEqual([
      'Inicio',
      'Respaldos',
    ]);

    expect(getBreadcrumbs('/settings/fiscal').map((crumb) => crumb.label)).toEqual([
      'Inicio',
      'Configuracion',
      'Datos fiscales',
    ]);
  });

  it('keeps the cashier invoice path understandable', () => {
    expect(getBreadcrumbs('/billing/new').map((crumb) => crumb.label)).toEqual([
      'Inicio',
      'Facturacion',
      'Nueva factura',
    ]);
  });
});
