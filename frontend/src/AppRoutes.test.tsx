import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './AppRoutes';
import { type AuthUser } from './lib/api';
import { AdminSessionProvider } from './shell/admin/AdminSessionContext';

function authUser(roles: string[], permissions: string[]): AuthUser {
  return {
    id: 7,
    name: 'Usuario de prueba',
    email: 'prueba@hospital.local',
    username: 'prueba',
    active: true,
    roles,
    permissions,
    must_change_password: false,
  };
}

const baseProps = {
  canCreateInvoices: false,
  canCreatePayments: false,
  canEditFiscalSettings: false,
  canEditOperationalSettings: false,
  canManageCatalog: false,
  canOpenCash: false,
  canCloseAnyCash: false,
  canCloseCash: false,
  canViewBackups: false,
  canViewCash: false,
  canViewCatalog: false,
  canViewReceipts: false,
  canViewFiscalSettings: false,
  canViewReceiptSettings: false,
  canEditReceiptSettings: false,
  canEditAdvancedReceiptSettings: false,
  canViewInvoices: false,
  canViewReports: false,
  canViewManagerialReports: false,
  canViewCashSessionReports: false,
  canViewAuditReports: false,
  canExportReports: false,
  canViewUsers: false,
  canCreateUsers: false,
  canUpdateUsers: false,
  canDisableUsers: false,
  canManageRoles: false,
  canMarkDialysisPrescription: false,
  cashSession: null,
  onStatus: () => undefined,
};

function renderAt(path: string, user: AuthUser) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AdminSessionProvider
          user={user}
          cashSession={baseProps.cashSession}
          cashSessionLoading={false}
          onStatus={baseProps.onStatus}
        >
          <AppRoutes {...baseProps} user={user} />
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cashier = authUser(
  ['cajero'],
  ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view', 'invoices.view'],
);

describe('AppRoutes: nueva navegación "Panel administrativo"', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza las secciones nuevas por ruta', async () => {
    renderAt('/resumen', authUser(['supervisor'], ['reports.managerial.view']));
    expect(await screen.findByRole('heading', { level: 1, name: /^resumen$/i })).toBeInTheDocument();

    cleanup();
    renderAt('/cobrar', cashier);
    expect(await screen.findByRole('heading', { level: 1, name: /^cobrar$/i })).toBeInTheDocument();

    cleanup();
    renderAt('/recibos', cashier);
    expect(await screen.findByRole('heading', { level: 1, name: /^recibos$/i })).toBeInTheDocument();

    cleanup();
    renderAt('/caja', cashier);
    expect(await screen.findByRole('heading', { level: 1, name: /^caja$/i })).toBeInTheDocument();

    cleanup();
    renderAt('/reportes/operaciones', authUser(['supervisor'], ['reports.managerial.view']));
    expect(await screen.findByRole('heading', { level: 1, name: /^reportes$/i })).toBeInTheDocument();
  });

  it('redirige las rutas antiguas a su destino nuevo', async () => {
    const fullAdmin = authUser(
      ['admin'],
      [
        'invoices.create',
        'catalog.view',
        'cash.view',
        'payments.create',
        'receipts.view',
        'invoices.view',
        'reports.managerial.view',
        // Secciones de Administración que los redirects de fondo piden
        // (adminNavigation): usuarios, ajustes y mantenimiento/respaldos.
        'users.view',
        'settings.fiscal.view',
        'backups.view',
      ],
    );
    // La tabla de redirects (AppRoutes.tsx) es canónica de MAPA_PRODUCTO.
    // Cada destino declara SU PROPIO h1 (composición 2026: «un encabezado
    // específico dentro de cada sección», sin h1 global de Administración):
    //   /administracion/catalogo   → «Productos y servicios» (catalog-title)
    //   /administracion/usuarios   → «Usuarios y roles» (users-title)
    //   /administracion/ajustes    → «Ajustes institucionales» (ajustes-title)
    //   /administracion/mantenimiento/respaldos → «Respaldos» (BackupsView)
    const cases: Array<[string, RegExp]> = [
      ['/dashboard', /^resumen$/i],
      ['/billing/new', /^cobrar$/i],
      ['/invoices', /^recibos$/i],
      ['/cashbox', /^caja$/i],
      ['/reports', /^reportes$/i],
      ['/catalog', /^Productos y servicios$/i],
      ['/admin/users', /^Usuarios y roles$/i],
      ['/settings/institutional-receipts', /^Ajustes institucionales$/i],
      ['/backups', /^Respaldos$/i],
    ];

    for (const [path, heading] of cases) {
      cleanup();
      renderAt(path, fullAdmin);
      // Redirección + destino real: el h1 canónico de la sección final
      // (waitFor interno de findByRole consume el lazy import y el Navigate).
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
  });

  it('aplica PermissionGate al cobro sin el paquete completo', async () => {
    renderAt('/cobrar', authUser(['cajero'], ['invoices.create']));

    expect(await screen.findByRole('heading', { level: 1, name: /sin permisos/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /^cobrar$/i })).not.toBeInTheDocument();
  });

  it('muestra el estado no encontrado con el componente admin para rutas desconocidas', () => {
    renderAt('/ruta-inexistente', cashier);

    expect(screen.getByText(/ruta no encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al inicio/i })).toHaveAttribute('href', '/cobrar');
  });
});
