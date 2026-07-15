import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api';
import { useServices } from './useServices';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getServicesPage: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

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

  it('does not request billing services without user intent', async () => {
    renderHook(() => useServices({ billing: true }), { wrapper });

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
    renderHook(() => useServices(filters), { wrapper });

    await waitFor(() => {
      expect(apiClient.getServicesPage).toHaveBeenCalledWith(filters, {
        signal: expect.any(AbortSignal),
      });
    });
  });

  it('keeps non-billing catalog queries enabled', async () => {
    renderHook(() => useServices({ active: true }), { wrapper });

    await waitFor(() => expect(apiClient.getServicesPage).toHaveBeenCalled());
  });
});
