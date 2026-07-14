import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateInvoice, useInvoices } from './useInvoices';
import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInvoices: vi.fn(),
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

describe('useInvoices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('trims text filters before querying invoice history', async () => {
    vi.mocked(apiClient.getInvoices).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 10, total: 0 } });

    renderHook(() => useInvoices({
      date_from: '2026-07-03',
      date_to: '2026-07-03',
      patient: '  Maria Lopez  ',
      invoice_number: '  000-001-01-00000022  ',
      status: '',
      page: 1,
      per_page: 10,
    }), { wrapper });

    await waitFor(() => expect(apiClient.getInvoices).toHaveBeenCalledWith({
      date_from: '2026-07-03',
      date_to: '2026-07-03',
      patient: 'Maria Lopez',
      invoice_number: '000-001-01-00000022',
      page: 1,
      per_page: 10,
    }));
  });
});

describe('useCreateInvoice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it('renews the idempotency key when the failed invoice payload changes', async () => {
    vi.mocked(createClientIdempotencyKey)
      .mockReturnValueOnce('invoice-attempt-1')
      .mockReturnValueOnce('invoice-attempt-2');
    vi.mocked(apiClient.createInvoice)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 2 } as Awaited<ReturnType<typeof apiClient.createInvoice>>);

    const changedPayload = {
      ...payload,
      patient_name: 'Paciente cambiado',
    };

    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    await expect(result.current.mutateAsync(payload)).rejects.toThrow('network');
    await result.current.mutateAsync(changedPayload);

    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(1, payload, {
      idempotencyKey: 'invoice-attempt-1',
    });
    expect(apiClient.createInvoice).toHaveBeenNthCalledWith(2, changedPayload, {
      idempotencyKey: 'invoice-attempt-2',
    });
    expect(createClientIdempotencyKey).toHaveBeenCalledTimes(2);
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
