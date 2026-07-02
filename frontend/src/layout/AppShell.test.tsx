import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { type AuthUser, type CashSession } from '../lib/api';
import { SidebarContent } from './Sidebar';
import { AppShell } from './AppShell';

vi.mock('../hooks/useFiscalSettings', () => ({
  usePublicBranding: () => ({ data: { hospital_name: 'Hospital San Isidro' } }),
}));

vi.mock('../lib/realtime/useBroadcastSync', () => ({
  useBroadcastSync: vi.fn(),
}));

vi.mock('../hooks/useServerStatus', () => ({
  useServerStatus: () => ({
    checking: false,
    isOnline: true,
    lastCheck: new Date('2026-06-16T10:00:00.000Z'),
    operationalHealth: null,
    summary: {
      label: 'Todo bien',
      description: 'Servidor local disponible.',
      level: 'ok',
    },
  }),
}));

vi.mock('../features/onboarding/GuidedTour', () => ({
  GuidedTour: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Guía rápida del sistema" /> : null),
  shouldAutoOpenGuidedTour: () => false,
}));

const baseUser: AuthUser = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: ['dashboard.view', 'catalog.view', 'cash.view'],
  must_change_password: false,
};

const fullCashierUser: AuthUser = {
  ...baseUser,
  permissions: [
    'dashboard.view',
    'invoices.create',
    'catalog.view',
    'cash.view',
    'payments.create',
    'receipts.view',
    'invoices.view',
    'reports.cash_session.view',
  ],
};

const cashSession: CashSession = {
  id: 12,
  user_id: 1,
  opening_amount: '100.00',
  closing_amount: null,
  expected_amount: null,
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: '2026-06-16T08:00:00.000Z',
  closed_at: null,
};

function renderShell({
  initialPath = '/dashboard',
  user = baseUser,
  onLogout = vi.fn(),
}: {
  initialPath?: string;
  user?: AuthUser;
  onLogout?: () => void;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell
        cashSession={cashSession}
        onLogout={onLogout}
        status="Servidor local disponible"
        user={user}
      >
        <div>Contenido</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('marks the active route with aria-current="page"', () => {
    renderShell({ initialPath: '/catalog' });

    const activeLink = screen.getByRole('link', { name: /catálogo/i });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(activeLink).toHaveAttribute('data-active', 'true');
  });

  it('keeps restricted navigation hidden until the user has all required permissions', () => {
    const { rerender } = renderShell({ user: { ...baseUser, permissions: ['dashboard.view', 'invoices.create'] } });

    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell
          cashSession={cashSession}
          onLogout={vi.fn()}
          status="Servidor local disponible"
          user={fullCashierUser}
        >
          <div>Contenido</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /nueva factura/i })).toBeInTheDocument();
  });

  it('opens mobile navigation, closes with Escape, and returns focus to the trigger', async () => {
    renderShell();

    const trigger = screen.getByRole('button', { name: /^abrir menú$/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /navegación principal/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /navegación principal/i })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('closes the mobile sidebar after navigating to another route', async () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /^abrir menú$/i }));
    const dialog = await screen.findByRole('dialog', { name: /navegación principal/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('link', { name: /catálogo/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /navegación principal/i })).not.toBeInTheDocument();
    });
  });

  it('exposes an accessible user menu by keyboard and preserves logout', async () => {
    const onLogout = vi.fn();
    renderShell({ onLogout });

    const trigger = screen.getByRole('button', { name: /abrir menu de usuario/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });

    const logoutItem = await screen.findByRole('menuitem', { name: /cerrar sesion/i });
    expect(logoutItem).toBeInTheDocument();

    fireEvent.click(logoutItem);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('keeps icon-only actions named and opens the guided tour from the shell', async () => {
    renderShell();

    expect(screen.getByRole('button', { name: /^abrir menú$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver atajos de teclado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir ayuda/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar a oscuro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menu de usuario/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver atajos de teclado/i }));
    expect(await screen.findByRole('dialog', { name: /atajos de teclado/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cerrar modal/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /atajos de teclado/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }));

    expect(await screen.findByRole('dialog', { name: /guía rápida del sistema/i })).toBeInTheDocument();
  });

  it('keeps operational cash and LAN status visible without changing dark-mode logic', () => {
    document.documentElement.classList.add('dark');
    const { container } = renderShell({ user: fullCashierUser });

    expect(screen.getAllByText(/caja #12/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/red local disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nueva factura/i })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="topbar-operational-status"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="sidebar-cash-status"]')).toBeInTheDocument();

    document.documentElement.classList.remove('dark');
  });

  it('renders safely with empty navigation input', () => {
    render(
      <MemoryRouter>
        <SidebarContent
          user={baseUser}
          cashSession={null}
          visibleNavigation={[]}
          activeItem={undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no hay módulos de navegación disponibles/i)).toBeInTheDocument();
  });
});
