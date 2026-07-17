import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFeedback, type FeedbackApi } from '@/design-system/providers/FeedbackProvider';
import { queryKeys } from '@/lib/queryKeys';
import { getEcho } from './echo';
import { useBroadcastSync } from './useBroadcastSync';

vi.mock('./echo', () => ({ getEcho: vi.fn() }));
vi.mock('@/design-system/providers/FeedbackProvider', () => ({ useFeedback: vi.fn() }));

type Listener = (payload: unknown) => void;

function createChannel() {
  const listeners = new Map<string, Listener>();

  return {
    listeners,
    listen: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, listener);
    }),
    stopListening: vi.fn((event: string, listener: Listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    }),
  };
}

function createEcho() {
  const channels = {
    invoices: createChannel(),
    cash: createChannel(),
    payments: createChannel(),
  };
  const echo = {
    private: vi.fn((name: keyof typeof channels) => channels[name]),
    leave: vi.fn(),
  };

  return { channels, echo };
}

function createFeedback(): FeedbackApi {
  return {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    notify: vi.fn(),
  };
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBroadcastSync', () => {
  let queryClient: QueryClient;
  let feedback: FeedbackApi;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    feedback = createFeedback();
    vi.mocked(useFeedback).mockReturnValue(feedback);
  });

  it('handles a payment broadcast once even though the backend publishes compatibility channels', async () => {
    const { channels, echo } = createEcho();
    vi.mocked(getEcho).mockResolvedValue(echo as never);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useBroadcastSync(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(echo.private).toHaveBeenCalledTimes(3));

    act(() => {
      for (const channel of Object.values(channels)) {
        channel.listeners.get('payment.changed')?.({
          id: 9,
          invoice_id: 4,
          change: 'registered',
          status: 'completed',
        });
      }
    });

    await waitFor(() => expect(feedback.success).toHaveBeenCalledTimes(1));
    expect(feedback.success).toHaveBeenCalledWith('Pago registrado.');
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('invalidates the intended queries and ignores malformed events', async () => {
    const { channels, echo } = createEcho();
    vi.mocked(getEcho).mockResolvedValue(echo as never);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useBroadcastSync(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(echo.private).toHaveBeenCalledTimes(3));

    act(() => {
      channels.invoices.listeners.get('invoice.changed')?.(null);
      channels.cash.listeners.get('cash-session.changed')?.({ id: 7, change: 'opened', status: 'open' });
    });

    expect(feedback.info).toHaveBeenCalledWith('Caja abierta #7.');
    expect(feedback.warning).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.cashSessions.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.reports.dashboard() });
  });

  it('removes every listener and leaves every channel on unmount', async () => {
    const { channels, echo } = createEcho();
    vi.mocked(getEcho).mockResolvedValue(echo as never);

    const { unmount } = renderHook(() => useBroadcastSync(), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(echo.private).toHaveBeenCalledTimes(3));

    unmount();

    expect(channels.invoices.stopListening).toHaveBeenCalledTimes(1);
    expect(channels.cash.stopListening).toHaveBeenCalledTimes(1);
    expect(channels.payments.stopListening).toHaveBeenCalledTimes(1);
    expect(echo.leave.mock.calls).toEqual([['invoices'], ['cash'], ['payments']]);
  });
});
