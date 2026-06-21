import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { configureAxe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

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
  GuidedTour: () => null,
  shouldAutoOpenGuidedTour: () => false,
}));

const adminUser = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'dashboard.view',
    'invoices.create',
    'payments.create',
    'receipts.view',
    'cash.view',
    'catalog.view',
    'invoices.view',
    'reports.view',
    'backups.view',
    'settings.fiscal.view',
    'receipt_settings.view',
    'users.view',
  ],
  must_change_password: false,
};

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/settings/institutional-receipts']}>
      <AppShell
        cashSession={null}
        onLogout={vi.fn()}
        status="Servidor local disponible"
        user={adminUser}
      >
        <h1>Panel operativo</h1>
        <button type="button">Accion principal</button>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell accessibility', () => {
  it('has no axe-core violations in the authenticated layout shell', async () => {
    const { container } = renderShell();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes skip link, landmarks and named operational navigation', () => {
    renderShell();

    expect(screen.getByRole('link', { name: /omitir al contenido principal/i })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: /navegaci/i });
    expect(within(navigation).getByRole('link', { name: /inicio/i })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: /nueva factura/i })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: /caja/i })).toBeInTheDocument();
  });

  it('announces the current breadcrumb semantically', () => {
    renderShell();

    const breadcrumbs = screen.getByRole('navigation', { name: /ruta actual/i });
    expect(within(breadcrumbs).getByText(/recibos institucionales/i)).toHaveAttribute('aria-current', 'page');
    expect(within(breadcrumbs).getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/dashboard');
  });

  it('keeps operational status available to assistive technologies', () => {
    renderShell();

    expect(screen.getByRole('status')).toHaveTextContent('Servidor local disponible');
    expect(screen.getByLabelText(/red local disponible/i)).toBeInTheDocument();
  });
});

