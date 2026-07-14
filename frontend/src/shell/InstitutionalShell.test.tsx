/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AuthUser, type CashSession } from '../lib/api';
import { InstitutionalShell } from './InstitutionalShell';
import { InstitutionalMobileNav } from './navigation/InstitutionalMobileNav';
import { InstitutionalRail } from './navigation/InstitutionalRail';

vi.mock('antd', async (importOriginal) => {
  const original = await importOriginal<typeof import('antd')>();
  return {
    ...original,
    Dropdown: ({ children, menu, open, onOpenChange }: any) => {
      console.log('Mock Dropdown rendering with open:', open);
      const child = React.Children.only(children);
      const childWithClick = React.cloneElement(child, {
        onClick: (e: any) => {
          console.log('Mock Dropdown click triggered, current open:', open);
          if (child.props.onClick) child.props.onClick(e);
          if (onOpenChange) {
            console.log('Mock Dropdown calling onOpenChange with:', !open);
            onOpenChange(!open);
          }
        },
      });

      return (
        <div className="ant-dropdown-trigger-container">
          {childWithClick}
          {open && (
            <div role="menu" className="ant-dropdown-menu">
              {menu.items.map((item: any) => {
                if (!item) return null;
                if (item.type === 'divider') return <hr key={item.key || Math.random()} />;
                if (item.type === 'group') {
                  return (
                    <div key={item.key || Math.random()} role="group">
                      {item.label}
                    </div>
                  );
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      if (onOpenChange) onOpenChange(false);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    },
  };
});

vi.mock('../hooks/useFiscalSettings', () => ({
  usePublicBranding: () => ({ data: { hospital_name: 'Hospital San Isidro' } }),
}));

vi.mock('../lib/realtime/useBroadcastSync', () => ({
  useBroadcastSync: vi.fn(),
}));

vi.mock('../hooks/useServerStatus', () => ({
  useServerStatus: () => ({ isOnline: true, lastCheck: new Date('2026-06-16T10:00:00.000Z') }),
}));

vi.mock('../features/onboarding/GuidedTour', () => ({
  GuidedTour: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Guía rápida del sistema" /> : null),
  shouldAutoOpenGuidedTour: () => false,
}));

const cashier: AuthUser = {
  id: 1,
  name: 'Cajera Hospital',
  email: 'cajera@hospital.local',
  username: 'cajera',
  active: true,
  roles: ['cashier'],
  permissions: [
    'dashboard.view',
    'invoices.create',
    'catalog.view',
    'cash.view',
    'payments.create',
    'receipts.view',
    'invoices.view',
  ],
  must_change_password: false,
};

const administrator: AuthUser = {
  ...cashier,
  name: 'Admin Hospital',
  roles: ['admin'],
  permissions: [
    ...cashier.permissions,
    'reports.managerial.view',
    'backups.view',
    'settings.fiscal.view',
    'receipt_settings.view',
    'users.view',
  ],
};

const openCashSession: CashSession = {
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

function LocationProbe() {
  return <output aria-label="Ruta de prueba">{useLocation().pathname}</output>;
}

function renderShell({
  cashSession = openCashSession,
  initialPath = '/dashboard',
  onLogout = vi.fn(),
  user = cashier,
}: {
  cashSession?: CashSession | null;
  initialPath?: string;
  onLogout?: () => void;
  user?: AuthUser;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <InstitutionalShell cashSession={cashSession} onLogout={onLogout} status="Servidor local disponible" user={user}>
        <div>Contenido</div>
        <LocationProbe />
      </InstitutionalShell>
    </MemoryRouter>,
  );
}

describe('InstitutionalShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('muestra una sola vez caja y hospital', () => {
    renderShell({ cashSession: openCashSession });

    expect(screen.getAllByText(/Caja #12/)).toHaveLength(1);
    expect(screen.getByText(/Caja #12/).parentElement).not.toHaveClass('hidden');
    const identities = screen.getAllByText('Hospital San Isidro');
    const mobileIdentity = screen.getByTestId('institutional-mobile-identity');
    const desktopIdentity = screen.getByTestId('institutional-desktop-identity');

    expect(identities).toHaveLength(2);
    expect(mobileIdentity).toHaveClass('lg:hidden');
    expect(desktopIdentity.closest('aside')).toHaveClass('hidden', 'lg:flex');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('mantiene identidad accesible y marca visible al reducir el rail', () => {
    window.localStorage.setItem('s-hospital-institutional-rail:v1', 'collapsed');
    renderShell();

    const rail = screen.getByTestId('institutional-rail');
    const brand = within(rail).getByLabelText('Hospital San Isidro');

    expect(rail).toHaveAttribute('data-collapsed', 'true');
    expect(brand).toHaveTextContent('HSI');
    expect(brand).toHaveAttribute('title', 'Hospital San Isidro');
  });

  it('la paleta excluye rutas sin permiso', () => {
    renderShell({ user: cashier });

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog', { name: 'Comandos' })).toBeVisible();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });

  it('el dock móvil contiene como máximo cuatro destinos', () => {
    renderShell({ user: administrator });

    const dock = screen.getByRole('navigation', { name: 'Accesos móviles' });
    expect(within(dock).getAllByRole('link')).toHaveLength(4);
  });

  it('explica la navegación vacía dentro del shell móvil', () => {
    render(
      <MemoryRouter>
        <InstitutionalMobileNav activeItem={undefined} navigation={[]} onOpenChange={vi.fn()} open={false} />
      </MemoryRouter>,
    );

    const mobileShell = screen.getByRole('navigation', { name: 'Accesos móviles' });
    expect(within(mobileShell).getByText('No hay destinos móviles disponibles.')).toBeInTheDocument();
  });

  it('marca la ruta activa con aria-current="page"', () => {
    renderShell({ initialPath: '/catalog' });

    const rail = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(rail).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('aria-current', 'page');
  });

  it('oculta Nueva factura sin los cinco permisos requeridos', () => {
    renderShell({ user: { ...cashier, permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create'] } });

    expect(screen.queryByRole('link', { name: 'Nueva factura' })).not.toBeInTheDocument();
  });

  it('reduce, expande y persiste el rail versionado', () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Reducir navegación' }));
    expect(screen.getByTestId('institutional-rail')).toHaveAttribute('data-collapsed', 'true');
    expect(window.localStorage.getItem('s-hospital-institutional-rail:v1')).toBe('collapsed');

    fireEvent.click(screen.getByRole('button', { name: 'Expandir navegación' }));
    expect(screen.getByTestId('institutional-rail')).toHaveAttribute('data-collapsed', 'false');
    expect(window.localStorage.getItem('s-hospital-institutional-rail:v1')).toBe('expanded');
  });

  it('usa un toggle de rail 44x44 sin ancho conflictivo', () => {
    renderShell();

    const toggle = screen.getByRole('button', { name: 'Reducir navegación' });
    expect(toggle).toHaveClass('!size-11');
    expect(toggle).not.toHaveClass('w-full');
  });

  it('no anima margin ni width del layout', () => {
    renderShell();

    expect(screen.getByRole('main').parentElement?.className).not.toMatch(/transition-\[(?:margin|width)\]/);
    expect(screen.getByTestId('institutional-rail').className).not.toMatch(/transition-\[(?:margin|width)\]/);
  });

  it('cierra el sheet móvil con Escape y devuelve foco', async () => {
    renderShell({ user: administrator });
    const trigger = screen.getByRole('button', { name: 'Más destinos' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Más destinos' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Más destinos' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('cierra el sheet móvil al navegar', async () => {
    renderShell({ user: administrator });
    fireEvent.click(screen.getByRole('button', { name: 'Más destinos' }));
    const dialog = screen.getByRole('dialog', { name: 'Más destinos' });

    fireEvent.click(within(dialog).getByRole('link', { name: 'Historial' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Más destinos' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Ruta de prueba')).toHaveTextContent('/invoices');
  });

  it('navega al elegir un comando y cierra la paleta', async () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Comandos' });

    fireEvent.click(within(dialog).getByText('Catálogo'));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Comandos' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Ruta de prueba')).toHaveTextContent('/catalog');
  });

  it('devuelve foco al trigger al cerrar la paleta de comandos', async () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Abrir comandos' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Comandos' }), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Comandos' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it.each(['input', 'textarea', 'select', 'contenteditable'] as const)(
    'Ctrl/Cmd+K no intercepta escritura en %s',
    (kind) => {
      renderShell();
      let editable: HTMLElement;
      if (kind === 'input') editable = document.body.appendChild(document.createElement('input'));
      else if (kind === 'textarea') editable = document.body.appendChild(document.createElement('textarea'));
      else if (kind === 'select') editable = document.body.appendChild(document.createElement('select'));
      else {
        editable = document.body.appendChild(document.createElement('div'));
        editable.contentEditable = 'true';
      }

      fireEvent.keyDown(editable, { key: 'k', ctrlKey: true });
      expect(screen.queryByRole('dialog', { name: 'Comandos' })).not.toBeInTheDocument();
    },
  );

  it('mantiene ? y GuidedTour accesibles', async () => {
    renderShell();

    fireEvent.keyDown(window, { key: '?' });
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible());
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Atajos de teclado' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ayuda' }));
    expect(screen.getByRole('dialog', { name: 'Guía rápida del sistema' })).toBeVisible();
  });

  it('mantiene el callback de logout', async () => {
    const onLogout = vi.fn();
    renderShell({ onLogout });
    const trigger = screen.getByRole('button', { name: 'Abrir menu de usuario' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Cerrar sesi.n/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('entrega el nombre real del hospital al menú de usuario', async () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Abrir menu de usuario' });
    fireEvent.click(trigger);

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Hospital San Isidro')).toBeInTheDocument();
  });

  it('explica una navegación vacía', () => {
    render(
      <MemoryRouter>
        <InstitutionalRail
          activeItem={undefined}
          collapsed={false}
          hospitalName="Hospital San Isidro"
          navigation={[]}
          onToggleCollapsed={vi.fn()}
          user={cashier}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No hay módulos de navegación disponibles.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });
});
