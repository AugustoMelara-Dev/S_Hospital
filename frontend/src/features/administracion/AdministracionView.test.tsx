import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AdministracionView, activeAdministrationItemId } from './AdministracionView';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { getVisibleAdministrationItems } from '@/navigation/adminNavigation';
import type { AuthUser } from '@/lib/api';

// Las superficies reales se aíslan: esta prueba verifica el shell de
// administración (navegación interna, permisos y sub-rutas), no cada vista.
vi.mock('./AuditView', () => ({ AuditView: () => <div data-testid="surface-auditoria"><h1>Auditoría</h1></div> }));
vi.mock('@/features/catalog/CatalogView', () => ({
  CatalogView: () => <div data-testid="surface-catalogo"><h1>Productos y servicios</h1></div>,
}));
vi.mock('@/features/admin/UsersView', () => ({
  UsersView: () => <div data-testid="surface-usuarios" />,
}));
vi.mock('@/features/settings/HospitalSettingsView', () => ({
  HospitalSettingsView: () => <div data-testid="surface-fiscal"><label htmlFor="hospital-draft">Nombre del hospital</label><input id="hospital-draft" defaultValue="Hospital inicial" /></div>,
}));
vi.mock('@/features/settings/FiscalNumerationView', () => ({
  FiscalNumerationView: () => <div data-testid="surface-numeracion" />,
}));
vi.mock('@/features/settings/OperationalRulesView', () => ({
  OperationalRulesView: () => <div data-testid="surface-reglas" />,
}));
vi.mock('@/features/receipt-settings/InstitutionalReceiptSettingsView', () => ({
  InstitutionalReceiptSettingsView: () => <div data-testid="surface-recibos" />,
}));
vi.mock('@/features/backups/BackupsView', () => ({
  BackupsView: () => <div data-testid="surface-respaldos" />,
}));

function authUser(permissions: string[]): AuthUser {
  return {
    id: 7,
    name: 'Admin de prueba',
    email: 'admin@hospital.local',
    username: 'admin',
    active: true,
    roles: ['admin'],
    permissions,
    must_change_password: false,
  };
}

function renderAt(path: string, permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AdminSessionProvider
          user={authUser(permissions)}
          cashSession={null}
          cashSessionLoading={false}
          onStatus={() => undefined}
        >
          <Routes>
            <Route path="/administracion/*" element={<AdministracionView />} />
          </Routes>
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdministracionView: navegación interna y permisos', () => {
  it('declara un único h1 específico y enruta el índice a la primera sección autorizada', async () => {
    renderAt('/administracion', ['catalog.view']);

    expect(screen.getByRole('heading', { level: 1, name: /^productos y servicios$/i })).toBeInTheDocument();
    expect(await screen.findByTestId('surface-catalogo')).toBeInTheDocument();
  });

  it('dibuja solo las secciones autorizadas y deja Ayuda disponible', async () => {
    renderAt('/administracion', ['catalog.view']);

    const nav = screen.getByRole('navigation', { name: /secciones de administración/i });
    expect(nav).toHaveTextContent(/catálogo y precios/i);
    expect(await screen.findByRole('link', { name: /^ayuda$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuarios y permisos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /mantenimiento y respaldos/i })).not.toBeInTheDocument();
  });

  it('deniega el acceso directo por URL a una sección sin permiso, sin montarla', async () => {
    renderAt('/administracion/usuarios', ['catalog.view']);

    expect(await screen.findByRole('heading', { level: 1, name: /sin permisos/i })).toBeInTheDocument();
    expect(screen.queryByTestId('surface-usuarios')).not.toBeInTheDocument();
  });

  it('declara el estado sin permiso en cada ruta administrativa no autorizada', async () => {
    for (const [path, surface] of [
      ['/administracion/usuarios', 'surface-usuarios'],
      ['/administracion/ajustes', 'surface-fiscal'],
      ['/administracion/mantenimiento/respaldos', 'surface-respaldos'],
    ] as const) {
      const { unmount } = renderAt(path, ['catalog.view']);

      expect(
        await screen.findByRole('heading', { level: 1, name: /sin permisos/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId(surface)).not.toBeInTheDocument();

      unmount();
    }
  });

  it('expone la ayuda contextual como destino breve', async () => {
    renderAt('/administracion/ayuda', []);

    expect(await screen.findByRole('heading', { level: 1, name: /^ayuda$/i })).toBeInTheDocument();
  });

  it('resuelve el mantenimiento por su sub-ruta de respaldos', async () => {
    renderAt('/administracion/mantenimiento/respaldos', ['backups.view']);

    expect(await screen.findByTestId('surface-respaldos')).toBeInTheDocument();
    expect(screen.getByText(/^mantenimiento$/i)).toBeInTheDocument();
    expect(screen.getByText(/conserve una descarga reciente fuera del equipo servidor/i)).toBeInTheDocument();
  });

  it('declara un solo destino actual en las pestañas horizontales, incluso con sub-rutas anidadas', async () => {
    renderAt('/administracion/mantenimiento/respaldos', ['catalog.view', 'users.view', 'backups.view']);

    const nav = screen.getByRole('navigation', { name: /secciones de administración/i });
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-label', 'Mantenimiento y respaldos');
  });

  it('resuelve el destino actual por la coincidencia más específica', () => {
    const items = getVisibleAdministrationItems([
      'catalog.view',
      'users.view',
      'settings.fiscal.view',
      'backups.view',
    ]);

    expect(activeAdministrationItemId('/administracion/mantenimiento/respaldos', items)).toBe('mantenimiento');
    expect(activeAdministrationItemId('/administracion/catalogo', items)).toBe('catalogo');
    expect(activeAdministrationItemId('/administracion/desconocida', items)).toBeNull();
  });

  it('la navegación interna de Ajustes declara una sola pestaña activa', async () => {
    renderAt('/administracion/ajustes', ['settings.fiscal.view', 'receipt_settings.view', 'receipt_settings.advanced']);

    const tablist = await screen.findByRole('tablist', { name: /secciones de ajustes/i });
    const tabs = within(tablist).getAllByRole('tab');

    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    // Requisito real (WCAG 2.1.1): el tablist debe ser alcanzable con Tab. Si
    // TODAS las pestañas quedan en `tabindex="-1"`, el grupo es inalcanzable por
    // teclado; al menos la activa debe estar en el orden de tabulación.
    const tabbable = tabs.filter((tab) => tab.getAttribute('tabindex') !== '-1');
    expect(tabbable.length, 'al menos una pestaña debe estar en el orden de tabulación').toBeGreaterThanOrEqual(1);
  });

  it('abre directamente papel y copias desde un enlace administrativo', async () => {
    renderAt('/administracion/ajustes?panel=papel', ['settings.fiscal.view', 'receipt_settings.view', 'receipt_settings.advanced']);

    expect(await screen.findByTestId('surface-recibos')).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: /secciones de ajustes/i });
    expect(within(tabs).getByRole('tab', { name: /^impresión$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('conserva un borrador al cambiar entre tareas de ajustes', async () => {
    const user = userEvent.setup();
    renderAt('/administracion/ajustes', ['settings.fiscal.view']);

    const draft = await screen.findByLabelText('Nombre del hospital');
    await user.clear(draft);
    await user.type(draft, 'Hospital en edición');
    const tabs = screen.getByRole('tablist', { name: /secciones de ajustes/i });
    await user.click(within(tabs).getByRole('tab', { name: /^numeración$/i }));
    await user.click(within(tabs).getByRole('tab', { name: /^identidad$/i }));

    expect(screen.getByLabelText('Nombre del hospital')).toHaveValue('Hospital en edición');
  });

  it('deja los destinos administrativos alcanzables por teclado', async () => {
    const user = userEvent.setup();
    renderAt('/administracion/catalogo', ['catalog.view', 'users.view']);

    const nav = screen.getByRole('navigation', { name: /secciones de administración/i });
    const userLink = within(nav).getByRole('link', { name: /^usuarios y permisos$/i });

    expect(userLink).not.toHaveAttribute('tabindex', '-1');

    await user.click(userLink);

    expect(await screen.findByTestId('surface-usuarios')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^usuarios y permisos$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('Administración auditoría', () => {
  it('abre auditoría para audit.view', async () => {
    renderAt('/administracion/auditoria', ['audit.view']);
    expect(await screen.findByTestId('surface-auditoria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Auditoría$/ })).toHaveAttribute('aria-current', 'page');
  });
  it('deniega acceso directo sin audit.view', async () => {
    renderAt('/administracion/auditoria', ['catalog.view']);
    expect(await screen.findByRole('heading', { level: 1, name: /sin permisos/i })).toBeInTheDocument();
    expect(screen.queryByTestId('surface-auditoria')).not.toBeInTheDocument();
  });
});
