import type React from 'react';
import type { FormEvent } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHospitalSession } from './useHospitalSession';
import { apiClient } from '../lib/api';
import { disconnectEcho } from '../lib/realtime/echo';
import { invalidateCsrfCookie } from '../lib/csrf';

vi.mock('../lib/realtime/echo', () => ({
  disconnectEcho: vi.fn(),
}));

vi.mock('../lib/csrf', () => ({
  invalidateCsrfCookie: vi.fn().mockResolvedValue(undefined),
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function SessionProbe() {
  const session = useHospitalSession();

  return (
    <output>
      {session.loading ? 'loading' : 'ready'}:{session.sessionExpired ? 'expired' : 'active'}
    </output>
  );
}

function LoginProbe() {
  const session = useHospitalSession();

  return (
    <button
      type="button"
      onClick={() => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
        void session.handleLogin(event);
        void session.handleLogin(event);
      }}
    >
      {session.loginSubmitting ? 'submitting' : 'submit'}
    </button>
  );
}

describe('useHospitalSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(disconnectEcho).mockClear();
    vi.mocked(invalidateCsrfCookie).mockClear();
  });

  it('invalidates cached session state when the API reports an expired session', async () => {
    let expireSession: (() => void) | null = null;
    const unsubscribe = vi.fn();

    vi.spyOn(apiClient, 'session').mockResolvedValue(null);
    vi.spyOn(apiClient, 'onSessionExpired').mockImplementation((handler) => {
      expireSession = handler;

      return unsubscribe;
    });
    const invalidateSession = vi.spyOn(apiClient, 'invalidateSession').mockImplementation(() => undefined);

    render(<SessionProbe />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('ready:active')).toBeInTheDocument());

    act(() => {
      expireSession?.();
    });

    expect(invalidateSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ready:expired')).toBeInTheDocument();
  });

  it('cleans up Echo, the query cache, and the CSRF cookie on session expiry', async () => {
    let expireSession: (() => void) | null = null;
    const unsubscribe = vi.fn();

    vi.spyOn(apiClient, 'session').mockResolvedValue(null);
    vi.spyOn(apiClient, 'onSessionExpired').mockImplementation((handler) => {
      expireSession = handler;

      return unsubscribe;
    });
    vi.spyOn(apiClient, 'invalidateSession').mockImplementation(() => undefined);

    render(<SessionProbe />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('ready:active')).toBeInTheDocument());

    act(() => {
      expireSession?.();
    });

    expect(disconnectEcho).toHaveBeenCalledTimes(1);
    expect(invalidateCsrfCookie).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate login submits while the first request is in flight', async () => {
    let resolveLogin!: (value: Awaited<ReturnType<typeof apiClient.login>>) => void;

    vi.spyOn(apiClient, 'session').mockResolvedValue(null);
    const login = vi.spyOn(apiClient, 'login').mockReturnValue(new Promise((resolve) => {
      resolveLogin = resolve;
    }));

    render(<LoginProbe />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument());
    act(() => {
      screen.getByRole('button', { name: 'submit' }).click();
    });

    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'submitting' })).toBeInTheDocument();

    await act(async () => {
      resolveLogin({
        id: 1,
        name: 'Cajero',
        email: 'cajero@hospital.local',
        username: 'cajero',
        active: true,
        roles: ['cajero'],
        permissions: [],
        must_change_password: false,
      });
    });
  });
});
