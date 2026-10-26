import { describe, expect, it } from 'vitest';
import {
  canAccessAdminItem,
  getActiveAdminSection,
  getVisibleAdministrationItems,
  getVisibleAdminSections,
  adminPrimarySections,
  resolveAdminLanding,
} from './adminNavigation';

const cashierPermissions = [
  'invoices.create',
  'catalog.view',
  'cash.view',
  'payments.create',
  'receipts.view',
  'invoices.view',
];

describe('adminNavigation', () => {
  it('define las secciones primarias en el orden y rutas del contrato', () => {
    expect(adminPrimarySections.map((item) => item.label)).toEqual([
      'Resumen',
      'Cobrar',
      'Recibos',
      'Caja',
      'Reportes',
    ]);
    expect(adminPrimarySections.map((item) => item.path)).toEqual([
      '/resumen',
      '/cobrar',
      '/recibos',
      '/caja',
      '/reportes',
    ]);
  });

  it('aterriza al cajero en /cobrar y al resto en /resumen', () => {
    expect(resolveAdminLanding({ roles: ['cajero'], permissions: cashierPermissions })).toBe('/cobrar');
    expect(resolveAdminLanding({ roles: ['supervisor'], permissions: cashierPermissions })).toBe('/resumen');
    expect(resolveAdminLanding({ roles: ['admin'], permissions: ['users.view'] })).toBe('/resumen');
    // Cajero sin el paquete completo de cobro cae a Resumen.
    expect(resolveAdminLanding({ roles: ['cajero'], permissions: ['invoices.create'] })).toBe('/resumen');
  });

  it('filtra secciones primarias por permisos', () => {
    expect(getVisibleAdminSections(cashierPermissions).map((item) => item.id)).toEqual([
      'resumen',
      'cobrar',
      'recibos',
      'caja',
    ]);
    expect(getVisibleAdminSections(['reports.managerial.view']).map((item) => item.id)).toEqual([
      'resumen',
      'reportes',
    ]);
    expect(canAccessAdminItem(adminPrimarySections[1], ['invoices.create'])).toBe(false);
    expect(canAccessAdminItem(adminPrimarySections[1], cashierPermissions)).toBe(true);
  });

  it('resuelve la sección activa por la ruta más específica', () => {
    expect(getActiveAdminSection('/reportes/operaciones', ['reports.managerial.view'])?.id).toBe('reportes');
    expect(getActiveAdminSection('/recibos/123', ['invoices.view'])?.id).toBe('recibos');
    expect(getActiveAdminSection('/administracion/ajustes', ['settings.fiscal.view'])).toBeUndefined();
    expect(getActiveAdminSection('/resumen', [])?.id).toBe('resumen');
  });

  it('expone Administración como menú secundario filtrado por permisos', () => {
    expect(getVisibleAdministrationItems(['catalog.view']).map((item) => item.id)).toEqual([
      'catalogo',
      'ayuda',
    ]);
    expect(getVisibleAdministrationItems(['settings.fiscal.view']).map((item) => item.id)).toEqual([
      'ajustes',
      'ayuda',
    ]);
    expect(getVisibleAdministrationItems(['backups.view']).map((item) => item.id)).toEqual([
      'mantenimiento',
      'ayuda',
    ]);
    expect(getVisibleAdministrationItems(['catalog.manage']).map((item) => item.id)).toEqual([
      'catalogo',
      'ayuda',
    ]);
    expect(getVisibleAdministrationItems(['receipt_settings.view']).map((item) => item.id)).toEqual([
      'ayuda',
    ]);
    expect(getVisibleAdministrationItems(['receipt_settings.advanced']).map((item) => item.id)).toEqual(['ayuda']);
    expect(getVisibleAdministrationItems(['receipt_settings.view', 'receipt_settings.advanced']).map((item) => item.id)).toEqual([
      'ajustes',
      'ayuda',
    ]);
    // Ayuda no exige permiso: siempre está disponible como acceso secundario.
    expect(getVisibleAdministrationItems([]).map((item) => item.id)).toEqual(['ayuda']);
  });
});

describe('separación de auditoría y finanzas', () => {
  it('ofrece auditoría a audit.view sin habilitar reportes financieros', () => {
    expect(getVisibleAdminSections(['audit.view']).map((item) => item.id)).not.toContain('reportes');
    expect(getVisibleAdministrationItems(['audit.view']).find((item) => item.id === 'auditoria')?.path).toBe('/administracion/auditoria');
    expect(getVisibleAdministrationItems([]).map((item) => item.id)).not.toContain('auditoria');
  });
});
