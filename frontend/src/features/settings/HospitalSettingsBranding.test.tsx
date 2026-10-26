import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HospitalSettingsView } from './HospitalSettingsView';
import { AdminShell } from '@/shell/admin/AdminShell';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { apiClient, type AuthUser, type FiscalSettings, type PublicBranding } from '@/lib/api';

vi.mock('@/lib/realtime/useBroadcastSync', () => ({ useBroadcastSync: vi.fn() }));

const user: AuthUser = {
  id: 1, name: 'Administración', email: 'admin@hospital.local', username: 'admin',
  active: true, roles: ['admin'], permissions: ['settings.fiscal.view', 'settings.fiscal.update'],
  must_change_password: false,
};
const initialSettings: FiscalSettings = {
  hospital_name: 'Hospital Regional del Norte', rtn: '08011999000001',
  default_tax_rate: '15.00', primary_color: 'blue', address: 'Dirección institucional',
};
const nextName = 'Hospital General San Isidro';

function renderIdentity(queryClient: QueryClient) {
  const onStatus = vi.fn();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/administracion/hospital']}>
        <AdminSessionProvider user={user} cashSession={null} cashSessionLoading={false} onStatus={onStatus}>
          <AdminShell user={user} cashSession={null} onLogout={vi.fn()} status="">
            <HospitalSettingsView canEdit onStatus={onStatus} />
          </AdminShell>
        </AdminSessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Hospital identity shared by settings and navigation', () => {
  it('updates desktop, mobile header and drawer immediately, and preserves the name after reload', async () => {
    let stored: FiscalSettings = { ...initialSettings };
    let releaseRefresh: ((value: PublicBranding) => void) | undefined;
    vi.spyOn(apiClient, 'getFiscalSettings').mockImplementation(async () => stored);
    vi.spyOn(apiClient, 'getPublicBranding')
      .mockImplementationOnce(async () => stored)
      .mockImplementationOnce(() => new Promise<PublicBranding>(resolve => { releaseRefresh = resolve; }))
      .mockImplementation(async () => stored);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockImplementation(async payload => {
      stored = { ...stored, ...payload };
      return stored;
    });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
    const first = renderIdentity(cache);
    await screen.findByRole('link', { name: `${initialSettings.hospital_name} — inicio` });
    fireEvent.change(await screen.findByLabelText(/nombre del hospital/i), { target: { value: nextName } });
    fireEvent.click(screen.getByRole('button', { name: /guardar datos del hospital/i }));

    // A slow branding GET must not keep the shell on the old name after PUT succeeds.
    await screen.findByRole('link', { name: `${nextName} — inicio` });
    expect(screen.getByRole('button', { name: /abrir navegación/i }).closest('header')).toHaveTextContent(nextName);
    fireEvent.click(screen.getByRole('button', { name: /abrir navegación/i }));
    const drawer = screen.getByRole('dialog', { name: /^navegación$/i });
    expect(within(drawer).getByRole('link', { name: `${nextName} — inicio` })).toBeInTheDocument();
    releaseRefresh?.(stored);
    await waitFor(() => expect(apiClient.updateFiscalSettings).toHaveBeenCalledTimes(1));
    first.unmount();
    cache.clear();

    const freshCache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const reloaded = renderIdentity(freshCache);
    await screen.findByRole('link', { name: `${nextName} — inicio` });
    expect(await screen.findByLabelText(/nombre del hospital/i)).toHaveValue(nextName);
    reloaded.unmount();
    freshCache.clear();
  });
});
