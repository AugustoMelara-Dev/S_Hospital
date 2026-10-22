import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AjustesView } from './AjustesView';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import type { AuthUser } from '@/lib/api';

vi.mock('@/features/settings/HospitalSettingsView', () => ({
  HospitalSettingsView: () => <div data-testid="surface-identidad" />,
}));
vi.mock('@/features/settings/FiscalNumerationView', () => ({
  FiscalNumerationView: () => <div data-testid="surface-numeracion" />,
}));
vi.mock('@/features/settings/OperationalRulesView', () => ({
  OperationalRulesView: () => <div data-testid="surface-reglas" />,
}));
vi.mock('@/features/receipt-settings/InstitutionalReceiptSettingsView', () => ({
  InstitutionalReceiptSettingsView: () => <div data-testid="surface-impresion" />,
}));
vi.mock('@/features/settings/TaxRatesView', () => ({
  TaxRatesView: ({ canEdit }: { canEdit: boolean }) => (
    <div data-testid="surface-impuestos" data-can-edit={String(canEdit)} />
  ),
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

function renderAjustes(permissions: string[]) {
  return render(
    <MemoryRouter initialEntries={['/administracion/ajustes']}>
      <AdminSessionProvider
        user={authUser(permissions)}
        cashSession={null}
        cashSessionLoading={false}
        onStatus={() => undefined}
      >
        <AjustesView />
      </AdminSessionProvider>
    </MemoryRouter>,
  );
}

describe('AjustesView · pestaña Impuestos', () => {
  it('abre Impuestos con permiso de lectura y habilita la edición sólo con settings.fiscal.update', async () => {
    const user = userEvent.setup();
    renderAjustes(['settings.fiscal.view', 'settings.fiscal.update']);

    const tablist = screen.getByRole('tablist', { name: /secciones de ajustes/i });
    await user.click(within(tablist).getByRole('tab', { name: /^impuestos$/i }));

    const surface = await screen.findByTestId('surface-impuestos');
    expect(surface).toHaveAttribute('data-can-edit', 'true');
    expect(within(tablist).getByRole('tab', { name: /^impuestos$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('con sólo lectura de ajustes fiscales muestra Impuestos sin edición', async () => {
    const user = userEvent.setup();
    renderAjustes(['settings.fiscal.view']);

    const tablist = screen.getByRole('tablist', { name: /secciones de ajustes/i });
    await user.click(within(tablist).getByRole('tab', { name: /^impuestos$/i }));

    expect(await screen.findByTestId('surface-impuestos')).toHaveAttribute('data-can-edit', 'false');
  });

  it('oculta la pestaña sin permiso fiscal', () => {
    renderAjustes(['settings.operational.update']);

    const tablist = screen.getByRole('tablist', { name: /secciones de ajustes/i });
    expect(within(tablist).queryByRole('tab', { name: /^impuestos$/i })).not.toBeInTheDocument();
  });
});
