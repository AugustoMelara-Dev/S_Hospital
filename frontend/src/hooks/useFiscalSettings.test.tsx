import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, type FiscalSettings } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useUpdateFiscalSettings } from './useFiscalSettings';

afterEach(() => vi.restoreAllMocks());

const settings: FiscalSettings = {
  hospital_name: 'Hospital Regional', rtn: '08011999000001',
  default_tax_rate: '15.00', primary_color: 'blue', address: 'Dirección institucional',
};

function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(queryKeys.settings.fiscal(), settings);
  cache.setQueryData(queryKeys.settings.branding(), { hospital_name: settings.hospital_name, primary_color: 'blue' });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
  return { cache, ...renderHook(() => useUpdateFiscalSettings(), { wrapper }) };
}

describe('useUpdateFiscalSettings branding synchronization', () => {
  it('publishes the saved name to both caches without copying private fiscal fields into public branding', async () => {
    const updated = { ...settings, hospital_name: 'Hospital San Isidro', slogan: 'Atención hospitalaria' };
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(updated);
    const { result, cache, unmount } = setup();
    await act(async () => { await result.current.mutateAsync({ hospital_name: updated.hospital_name }); });
    expect(cache.getQueryData(queryKeys.settings.fiscal())).toEqual(updated);
    expect(cache.getQueryData(queryKeys.settings.branding())).toMatchObject({ hospital_name: updated.hospital_name, slogan: updated.slogan });
    expect(cache.getQueryData(queryKeys.settings.branding())).not.toHaveProperty('rtn');
    expect(cache.getQueryData(queryKeys.settings.branding())).not.toHaveProperty('default_tax_rate');
    unmount(); cache.clear();
  });

  it('preserves the visible identity when the save fails', async () => {
    vi.spyOn(apiClient, 'updateFiscalSettings').mockRejectedValue(new Error('Sin conexión local'));
    const { result, cache, unmount } = setup();
    await act(async () => { await expect(result.current.mutateAsync({ hospital_name: 'Cambio no guardado' })).rejects.toThrow('Sin conexión local'); });
    expect(cache.getQueryData(queryKeys.settings.fiscal())).toEqual(settings);
    expect(cache.getQueryData(queryKeys.settings.branding())).toMatchObject({ hospital_name: settings.hospital_name });
    unmount(); cache.clear();
  });
});
