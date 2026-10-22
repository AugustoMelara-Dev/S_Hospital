import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api';
import { SERVICES_SEARCH_DEBOUNCE_MS, useServices } from './useServices';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getServicesPage: vi.fn(),
  },
}));

/**
 * El QueryClient se memoriza para que un `rerender` del hook no lo recree (si
 * se recreara, la caché se perdería y cualquier aserción de "no hay consulta
 * nueva" sería falsa).
 */
function TestQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const emptyPage = {
  data: [],
  meta: { current_page: 1, per_page: 24, total: 0 },
};

describe('useServices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiClient.getServicesPage).mockResolvedValue(emptyPage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not request billing services without user intent', async () => {
    renderHook(() => useServices({ billing: true }), { wrapper: TestQueryProvider });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(apiClient.getServicesPage).not.toHaveBeenCalled();
  });

  it.each([
    { search: 'glucosa' },
    { code: 'LAB-001' },
    { categoryId: 3 },
    { areaId: 2 },
  ])('requests billing services for explicit filters: %o', async (intent) => {
    const filters = { billing: true, ...intent };
    renderHook(() => useServices(filters), { wrapper: TestQueryProvider });

    await waitFor(() => {
      expect(apiClient.getServicesPage).toHaveBeenCalledWith(filters, {
        signal: expect.any(AbortSignal),
      });
    });
  });

  it('keeps non-billing catalog queries enabled', async () => {
    renderHook(() => useServices({ active: true }), { wrapper: TestQueryProvider });

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());
  });

  it('no retrasa la primera consulta y agrupa la ráfaga de búsqueda en una sola petición', async () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(
      ({ search }: { search: string | undefined }) =>
        useServices({ billing: true, search }, { enabled: true }),
      { wrapper: TestQueryProvider, initialProps: { search: undefined as string | undefined } },
    );

    // Montaje: la consulta inicial sale sin espera.
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiClient.getServicesPage).toHaveBeenCalledTimes(1);

    // Ráfaga de tecleo: ninguna consulta intermedia sale de la ventana.
    rerender({ search: 'g' });
    rerender({ search: 'gl' });
    rerender({ search: 'glu' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiClient.getServicesPage).toHaveBeenCalledTimes(1);

    // Al asentarse el silencio sólo se pide el último término.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SERVICES_SEARCH_DEBOUNCE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.getServicesPage).toHaveBeenCalledTimes(2);
    expect(apiClient.getServicesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'glu' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiClient.getServicesPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: 'g' }),
      expect.anything(),
    );
  });
});
