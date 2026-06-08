export type AppRoute = {
  label: string;
  path: string;
  phase: string;
  permission?: string;
};

export const routes: AppRoute[] = [
  { label: 'Inicio', path: '/dashboard', phase: 'Fase 12A' },
  { label: 'Nueva factura', path: '/billing/new', phase: 'Fase 12A', permission: 'invoices.create' },
  { label: 'Caja', path: '/cashbox', phase: 'Fase 12A', permission: 'cash.view' },
  { label: 'Catálogo', path: '/catalog', phase: 'Fase 12A', permission: 'catalog.view' },
  { label: 'Historial', path: '/invoices', phase: 'Fase 12A', permission: 'invoices.view' },
  { label: 'Servicios pagados', path: '/area/services', phase: 'Fase 12 área', permission: 'areas.paid_services.view' },
  { label: 'Reportes', path: '/reports', phase: 'Fase 12A', permission: 'reports.view' },
  { label: 'Respaldos', path: '/backups', phase: 'Fase 12A', permission: 'backups.view' },
  {
    label: 'Configuración',
    path: '/settings/fiscal',
    phase: 'Fase 12A',
    permission: 'settings.fiscal.view',
  },
];
