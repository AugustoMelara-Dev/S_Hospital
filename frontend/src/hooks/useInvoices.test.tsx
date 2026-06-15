import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateInvoice } from './useInvoices';
import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';

vi.mock('@/lib/api', () => ({
  apiClient: {
    createInvoice: vi.fn(),
  },
}));

vi.mock('@/lib/api/base', () => ({
  createClientIdempotencyKey: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const payload = {
  patient_name: 'Paciente',
  patient_dialysis_prescription: false,
  items: [{ service_id: 1, quantity: '1.00', notes: null }],
};

describe('useCreateInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the idempotency key for the same failed submit attempt', async () => {
    vi.mocked(createClientIdempotencyKey).mockReturnValue('stable-submit-key');
    vi.mocked(apiClient.createInvoice)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network again'));

    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isError).toBe(true));

    result.current.reset();
    result.current.mutate(payload);
    await waitFor(() => expect(vi.mocked(apiClient.createInvoice)).toHaveBeenCalledTimes(2));

    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(1, payload, {
      idempotencyKey: 'stable-submit-key',
    });
    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(2, payload, {
      idempotencyKey: 'stable-submit-key',
    });
    expect(createClientIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('clears the idempotency key after confirmed success', async () => {
    vi.mocked(createClientIdempotencyKey)
      .mockReturnValueOnce('first-key')
      .mockReturnValueOnce('second-key');
    vi.mocked(apiClient.createInvoice)
      .mockResolvedValueOnce({ id: 1 } as Awaited<ReturnType<typeof apiClient.createInvoice>>)
      .mockResolvedValueOnce({ id: 2 } as Awaited<ReturnType<typeof apiClient.createInvoice>>);

    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.reset();
    result.current.mutate(payload);
    await waitFor(() => expect(vi.mocked(apiClient.createInvoice)).toHaveBeenCalledTimes(2));

    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(1, payload, {
      idempotencyKey: 'first-key',
    });
    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(2, payload, {
      idempotencyKey: 'second-key',
    });
  });
});
