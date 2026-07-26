import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { configureAxe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { InstitutionalShell } from './InstitutionalShell';
import { ThemeProvider } from '@/design-system/providers/ThemeProvider';

const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });

Element.prototype.scrollIntoView = vi.fn();

vi.mock('../hooks/useFiscalSettings', () => ({
  usePublicBranding: () => ({ data: { hospital_name: 'Hospital General San Isidro' } }),
}));
vi.mock('../lib/realtime/useBroadcastSync', () => ({ useBroadcastSync: vi.fn() }));
vi.mock('../hooks/useServerStatus', () => ({
  useServerStatus: () => ({ isOnline: true, lastCheck: new Date('2026-06-16T10:00:00.000Z') }),
}));
vi.mock('../features/onboarding/GuidedTour', () => ({
  GuidedTour: () => null,
  shouldAutoOpenGuidedTour: () => false,
}));

const user = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: ['dashboard.view', 'cash.view', 'catalog.view', 'receipt_settings.view'],
  must_change_password: false,
};

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/settings/institutional-receipts']}>
      <ThemeProvider>
        <InstitutionalShell cashSession={null} onLogout={vi.fn()} status="Servidor local disponible" user={user}>
          <h1>Panel operativo</h1>
        </InstitutionalShell>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('InstitutionalShell accessibility', () => {
  it('no tiene violaciones axe en el shell autenticado', async () => {
    const { container } = renderShell();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('expone skip link y landmarks nombrados', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Omitir al contenido principal' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('expone estado y ubicación actual accesibles sin breadcrumb duplicado', () => {
    renderShell();
    expect(screen.getByRole('status')).toHaveTextContent('Servidor local disponible');
    expect(screen.getByLabelText('Conexión local disponible')).toBeInTheDocument();
    expect(screen.getByText('Recibos e impresion', { selector: '[data-current-location]' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Ruta actual' })).not.toBeInTheDocument();
  });

  it('keeps the content title as the only level-one heading', () => {
    renderShell();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Panel operativo');
    expect(screen.getByText('Recibos e impresion', { selector: '[data-current-location]' }).tagName).toBe('P');
  });
});
