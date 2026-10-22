import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette, openCommandPalette } from './CommandPalette';
import { AdminSessionProvider } from './AdminSessionContext';
import { requestAdminFocus } from '@/hooks/useAdminFocusRequest';
import { UnsavedChangesGuardProvider, useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type AuthUser } from '@/lib/api';

vi.mock('@/hooks/useAdminFocusRequest', () => ({
  requestAdminFocus: vi.fn(),
  clearAdminFocusRequest: vi.fn(),
  useAdminFocusRequest: vi.fn(),
}));

const admin: AuthUser = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'invoices.create',
    'invoices.view',
    'catalog.view',
    'cash.view',
    'cash.open',
    'cash.close',
    'payments.create',
    'receipts.view',
    'reports.managerial.view',
    'users.view',
    'settings.fiscal.view',
    'backups.view',
  ],
  must_change_password: false,
};

const viewer: AuthUser = {
  ...admin,
  id: 2,
  name: 'Consulta',
  roles: ['consulta'],
  permissions: ['invoices.view', 'receipts.view'],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

function DirtyFormProbe() {
  useUnsavedChangesGuard(true);
  return null;
}

it('solicita descartar cambios antes de navegar desde la búsqueda global', async () => {
  render(
    <MemoryRouter initialEntries={['/resumen']}>
      <AdminSessionProvider user={admin} cashSession={null} cashSessionLoading={false} onStatus={vi.fn()}>
        <UnsavedChangesGuardProvider>
          <DirtyFormProbe />
          <CommandPalette />
          <LocationProbe />
        </UnsavedChangesGuardProvider>
      </AdminSessionProvider>
    </MemoryRouter>,
  );
  openWithKeyboard();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ir a Recibos' } });
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
  await screen.findByRole('alertdialog');
  expect(screen.getByTestId('location')).toHaveTextContent('/resumen');
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/resumen');
  openWithKeyboard();
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/recibos'));
});

function renderPalette(user: AuthUser = admin) {
  render(
    <MemoryRouter initialEntries={['/resumen']}>
      <AdminSessionProvider user={user} cashSession={null} cashSessionLoading={false} onStatus={vi.fn()}>
        <CommandPalette />
        <LocationProbe />
      </AdminSessionProvider>
    </MemoryRouter>,
  );
}

function openWithKeyboard() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
}

function palette(): HTMLElement {
  return screen.getByRole('dialog', { name: /paleta de comandos/i });
}

function searchInput(): HTMLInputElement {
  return screen.getByRole('combobox', { name: /buscar acciones y operaciones/i }) as HTMLInputElement;
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.mocked(requestAdminFocus).mockClear();
  });

  it('permanece cerrada hasta Ctrl+K y se cierra con Escape', async () => {
    renderPalette();

    expect(screen.queryByRole('dialog')).toBeNull();

    openWithKeyboard();
    const dialog = palette();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(searchInput()).toHaveFocus());

    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre con Cmd+K y con el disparador del shell', () => {
    renderPalette();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(palette()).toBeInTheDocument();

    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => openCommandPalette());
    expect(palette()).toBeInTheDocument();
  });

  it('navega con flechas y abre la acción resaltada con Enter', async () => {
    renderPalette();
    openWithKeyboard();
    await waitFor(() => expect(searchInput()).toHaveFocus());

    expect(screen.getByRole('option', { name: /^ir a resumen/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchInput(), { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /^ir a cobrar/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchInput(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/cobrar'));
  });

  it('oculta acciones no autorizadas por permisos', () => {
    renderPalette(viewer);
    openWithKeyboard();

    expect(screen.getByRole('option', { name: /^ir a recibos/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^ir a cobrar/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^ir a caja/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^abrir caja/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^usuarios y permisos/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^ajustes institucionales/i })).toBeNull();
    // Buscar operaciones sí está autorizado (invoices.view).
    expect(screen.getByRole('option', { name: /^buscar operación/i })).toBeInTheDocument();
  });

  it('no ofrece acciones de caja si falta el permiso de acceso a la ruta', () => {
    renderPalette({
      ...viewer,
      permissions: ['cash.open', 'cash.close'],
    });
    openWithKeyboard();

    expect(screen.queryByRole('option', { name: /^ir a caja/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^abrir caja/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /^cerrar caja/i })).toBeNull();
  });

  it('filtra las acciones sin distinguir acentos', () => {
    renderPalette();
    openWithKeyboard();

    fireEvent.change(searchInput(), { target: { value: 'catalogo' } });

    const listbox = screen.getByRole('listbox', { name: /acciones disponibles/i });
    expect(within(listbox).getByRole('option', { name: /catálogo y precios/i })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: /ir a resumen/i })).toBeNull();
  });

  it('ofrece buscar operaciones por paciente y navega a Recibos con el término', async () => {
    renderPalette();
    openWithKeyboard();

    fireEvent.change(searchInput(), { target: { value: 'María López' } });

    const option = screen.getByRole('option', { name: /buscar operación “María López”/i });
    fireEvent.click(option);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/recibos?q=Mar%C3%ADa+L%C3%B3pez'),
    );
    expect(requestAdminFocus).toHaveBeenCalledWith('recibos-query');
  });

  it('interpreta un término numérico como número de documento', async () => {
    renderPalette();
    openWithKeyboard();

    fireEvent.change(searchInput(), { target: { value: '000-001-01-00000010' } });
    fireEvent.click(screen.getByRole('option', { name: /^buscar operación/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/recibos?invoice_number=000-001-01-00000010',
      ),
    );
  });

  it('devuelve el foco al disparador al cerrar', async () => {
    render(
      <MemoryRouter initialEntries={['/resumen']}>
        <AdminSessionProvider user={admin} cashSession={null} cashSessionLoading={false} onStatus={vi.fn()}>
          <button type="button">Abrir</button>
          <CommandPalette />
        </AdminSessionProvider>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Abrir' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    openWithKeyboard();
    await waitFor(() => expect(searchInput()).toHaveFocus());

    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });

  it('no secuestra Enter cuando no hay acción resaltada', () => {
    renderPalette({ ...viewer, permissions: [] });
    openWithKeyboard();

    fireEvent.change(searchInput(), { target: { value: 'zzzz-sin-coincidencias' } });

    expect(screen.getByRole('status')).toHaveTextContent(/sin acciones/i);
    fireEvent.keyDown(searchInput(), { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/resumen');
  });
});
