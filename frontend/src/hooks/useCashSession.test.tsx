import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { apiClient } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { useCloseCashSession, useOpenCashSession } from './useCashSession';

vi.mock('@/lib/api', () => ({
  apiClient: {
    openCashSession: vi.fn(),
    closeCashSession: vi.fn(),
  },
}));

vi.mock('@/lib/api/base', () => ({
  createClientIdempotencyKey: vi.fn(),
}));

const mockedOpenCashSession = vi.mocked(apiClient.openCashSession);
const mockedCloseCashSession = vi.mocked(apiClient.closeCashSession);
const mockedCreateClientIdempotencyKey = vi.mocked(createClientIdempotencyKey);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('cash session mutations', () => {
  beforeEach(() => {
    mockedOpenCashSession.mockReset();
    mockedCloseCashSession.mockReset();
    mockedCreateClientIdempotencyKey.mockReset();
  });

  it('reuses the open-session idempotency key for the same failed attempt', async () => {
    mockedCreateClientIdempotencyKey.mockReturnValue('cash-open-attempt-1');
    mockedOpenCashSession
      .mockRejectedValueOnce(new Error('LAN timeout'))
      .mockResolvedValueOnce({ id: 7, status: 'open' } as Awaited<ReturnType<typeof apiClient.openCashSession>>);

    const { result } = renderHook(() => useOpenCashSession(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({ opening_amount: '0.00' })).rejects.toThrow('LAN timeout');
    await result.current.mutateAsync({ opening_amount: '0.00' });

    await waitFor(() => expect(mockedOpenCashSession).toHaveBeenCalledTimes(2));
    expect(mockedOpenCashSession).toHaveBeenNthCalledWith(1, { opening_amount: '0.00' }, {
      idempotencyKey: 'cash-open-attempt-1',
    });
    expect(mockedOpenCashSession).toHaveBeenNthCalledWith(2, { opening_amount: '0.00' }, {
      idempotencyKey: 'cash-open-attempt-1',
    });
    expect(mockedCreateClientIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('renews the open-session idempotency key after a confirmed success', async () => {
    mockedCreateClientIdempotencyKey
      .mockReturnValueOnce('cash-open-attempt-1')
      .mockReturnValueOnce('cash-open-attempt-2');
    mockedOpenCashSession
      .mockResolvedValueOnce({ id: 7, status: 'open' } as Awaited<ReturnType<typeof apiClient.openCashSession>>)
      .mockResolvedValueOnce({ id: 8, status: 'open' } as Awaited<ReturnType<typeof apiClient.openCashSession>>);

    const { result } = renderHook(() => useOpenCashSession(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ opening_amount: '0.00' });
    await result.current.mutateAsync({ opening_amount: '50.00' });

    expect(mockedOpenCashSession).toHaveBeenNthCalledWith(1, { opening_amount: '0.00' }, {
      idempotencyKey: 'cash-open-attempt-1',
    });
    expect(mockedOpenCashSession).toHaveBeenNthCalledWith(2, { opening_amount: '50.00' }, {
      idempotencyKey: 'cash-open-attempt-2',
    });
  });

  it('reuses the close-session idempotency key for the same failed attempt', async () => {
    mockedCreateClientIdempotencyKey.mockReturnValue('cash-close-attempt-1');
    mockedCloseCashSession
      .mockRejectedValueOnce(new Error('LAN timeout'))
      .mockResolvedValueOnce({ id: 7, status: 'closed' } as Awaited<ReturnType<typeof apiClient.closeCashSession>>);

    const { result } = renderHook(() => useCloseCashSession(), {
      wrapper: createWrapper(),
    });

    const payload = { closing_amount: '250.00', notes: 'Cierre sin diferencia' };
    await expect(result.current.mutateAsync({ id: 7, payload })).rejects.toThrow('LAN timeout');
    await result.current.mutateAsync({ id: 7, payload });

    expect(mockedCloseCashSession).toHaveBeenNthCalledWith(1, 7, payload, {
      idempotencyKey: 'cash-close-attempt-1',
    });
    expect(mockedCloseCashSession).toHaveBeenNthCalledWith(2, 7, payload, {
      idempotencyKey: 'cash-close-attempt-1',
    });
    expect(mockedCreateClientIdempotencyKey).toHaveBeenCalledTimes(1);
  });
});
