import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';
import { AdminSessionProvider } from './AdminSessionContext';
import { type AuthUser, type CashSession } from '@/lib/api';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

vi.mock('@/hooks/useFiscalSettings', () => ({
  usePublicBranding: () => ({ data: { hospital_name: 'Hospital General San Isidro' } }),
}));

vi.mock('@/lib/realtime/useBroadcastSync', () => ({
  useBroadcastSync: vi.fn(),
}));

// La identidad dark es única y fija en ThemeProvider (clase html.dark siempre
// presente): el shell ya no consume contexto de tema y no hay mocked toggling
// que probar aquí.

const administrator: AuthUser = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'invoices.create',
    'catalog.view',
    'cash.view',
    'payments.create',
    'receipts.view',
    'invoices.view',
    'reports.managerial.view',
    'users.view',
    'settings.fiscal.view',
    'backups.view',
  ],
  must_change_password: false,
};

const openCashSession: CashSession = {
  id: 12,
  user_id: 1,
  opening_amount: '500.00',
  closing_amount: null,
  expected_amount: null,
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: '2026-06-16T08:00:00.000Z',
  closed_at: null,
  cash_register: { id: 2, code: 'ventanilla-2', name: 'Ventanilla principal' },
};

function DirtyFormProbe() {
  useUnsavedChangesGuard(true);
  return <p>Borrador pendiente</p>;
}

function renderShell(
  initialPath = '/cobrar',
  cashSession: CashSession | null = openCashSession,
  user: AuthUser = administrator,
  dirty = false,
) {
  const onLogout = vi.fn();

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminSessionProvider
        user={user}
        cashSession={cashSession}
        cashSessionLoading={false}
        onStatus={vi.fn()}
      >
        <AdminShell
          cashSession={cashSession}
          onLogout={onLogout}
          status="Impresora sin conexión. Revise el equipo antes de imprimir."
          user={user}
        >
          {dirty ? <DirtyFormProbe /> : null}
          <h1>Contenido</h1>
        </AdminShell>
      </AdminSessionProvider>
    </MemoryRouter>,
  );

  return { onLogout };
}

describe('AdminShell: navegación lateral del panel administrativo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza skip-link, secciones primarias y una sola entrada de administración', () => {
    renderShell();

    expect(screen.getByRole('link', { name: /omitir al contenido principal/i })).toHaveAttribute(
      'href',
      '#main-content',
    );

    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    for (const label of ['Resumen', 'Cobrar', 'Recibos', 'Caja', 'Reportes']) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument();
    }
    // V08: la barra lateral agrupa Administración en UNA entrada y no replica el
    // menú interno de AdministracionView.
    expect(screen.getByRole('link', { name: /^administración$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /catálogo y precios/i })).not.toBeInTheDocument();
  });

  it('marca la sección activa con aria-current y el fondo de acento', () => {
    renderShell('/cobrar');

    const active = screen.getByRole('link', { name: /^cobrar$/i });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('bg-[var(--ui-action)]');
    expect(screen.getByRole('link', { name: /^resumen$/i })).not.toHaveAttribute('aria-current');

    // Exactamente un destino puede reclamar la página en todo el DOM.
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('no reclama la página desde la entrada de administración', () => {
    renderShell('/administracion/catalogo');

    const admin = screen.getByRole('link', { name: /^administración$/i });
    expect(admin).not.toHaveAttribute('aria-current');
    expect(admin).toHaveAttribute('data-active', 'true');
  });

  it('muestra el estado de caja compacto sin franja técnica permanente', () => {
    renderShell();

    const cash = screen.getByRole('link', { name: /ventanilla principal/i });
    expect(cash).toHaveTextContent(/inicial/i);
    expect(screen.getByRole('status')).toHaveTextContent(/impresora sin conexión/i);
  });

  it('identifica el turno sin inventar una caja física cuando no viene en la respuesta', () => {
    renderShell('/cobrar', { ...openCashSession, cash_register: undefined });

    expect(screen.getByRole('link', { name: /turno #12/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /caja #12/i })).not.toBeInTheDocument();
  });

  it('indica la ausencia de caja abierta', () => {
    renderShell('/cobrar', null);

    expect(screen.getByRole('link', { name: /sin caja abierta/i })).toBeInTheDocument();
  });

  it('oculta tanto la sección como el estado de caja sin cash.view', () => {
    renderShell('/recibos', openCashSession, {
      ...administrator,
      roles: ['consulta'],
      permissions: ['invoices.view'],
    });

    expect(screen.queryByRole('link', { name: /^caja$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ventanilla principal/i })).not.toBeInTheDocument();
  });

  it('abre la navegación en móvil con el botón de menú', () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /abrir navegación/i }));

    const dialog = screen.getByRole('dialog', { name: /^navegación$/i });
    expect(dialog).toBeInTheDocument();

    // El cajón reutiliza el mismo AdminSidebar. Con el diálogo modal de Radix el
    // resto del documento queda aislado, así que el acceso es el único enlace
    // «Cobrar» alcanzable: antes el fondo seguía siendo tabulable.
    expect(within(dialog).getByRole('link', { name: /^cobrar$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /^administración$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^cobrar$/i })).toHaveLength(1);
  });

  it('atrapa el foco y aísla el fondo mientras el cajón está abierto', () => {
    renderShell();

    const opener = screen.getByRole('button', { name: /abrir navegación/i });
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: /^navegación$/i });

    // El foco entra en el cajón…
    expect(dialog.contains(document.activeElement)).toBe(true);
    // …y el fondo queda fuera del árbol de accesibilidad: el enlace «Cobrar» del
    // rail de escritorio ya no es alcanzable (antes sí lo era).
    expect(screen.getAllByRole('link', { name: /^cobrar$/i })).toHaveLength(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /^navegación$/i })).not.toBeInTheDocument();

    // Límite declarado: en jsdom no se dispara `animationend`, que es lo que
    // `@radix-ui/react-presence` escucha para desmontar y devolver el foco al
    // disparador. La restauración se verifica en navegador, no aquí.
  });

  it('permite cerrar sesión desde la barra lateral', () => {
    const { onLogout } = renderShell();

    fireEvent.click(screen.getByRole('button', { name: /^salir$/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('protege el borrador al cerrar sesión y sólo sale tras confirmar descarte', async () => {
    const { onLogout } = renderShell('/administracion/ajustes', openCashSession, administrator, true);

    fireEvent.click(screen.getByRole('button', { name: /^salir$/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /seguir editando/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^salir$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /descartar cambios/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
