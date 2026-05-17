export type AppRoute = {
  label: string;
  path: string;
  phase: string;
};

export const routes: AppRoute[] = [
  { label: 'Inicio', path: '/', phase: 'Bootstrap' },
  { label: 'Facturacion', path: '/invoices', phase: 'Fase 4' },
  { label: 'Caja', path: '/cashbox', phase: 'Fase 5' },
  { label: 'Reportes', path: '/reports', phase: 'Fase 7' },
  { label: 'Backups', path: '/backups', phase: 'Fase 8' },
];
