import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
  permissions: ['dashboard.view', 'catalog.view', 'cash.view'],
  must_change_password: false,
};

describe('AppShell', () => {
  it('closes the mobile sidebar after navigating to another route', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell
          cashSession={null}
          onLogout={vi.fn()}
          status="Listo"
          user={user}
        >
          <div>Contenido</div>
        </AppShell>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^abrir menú$/i }));
    const dialog = await screen.findByRole('dialog', { name: /navegación principal/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('link', { name: /catálogo/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /navegación principal/i })).not.toBeInTheDocument();
    });
  });
});
