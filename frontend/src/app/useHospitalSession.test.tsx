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

function PermissionProbe() {
  const session = useHospitalSession();

  return (
    <output>
      {`${session.loading ? 'loading' : 'ready'}:reports=${session.canViewReports ? 'yes' : 'no'}:operational=${session.hasAnyOperationalPermission ? 'yes' : 'no'}`}
    </output>
  );
}

function CashPermissionProbe() {
  const session = useHospitalSession();

  return (
    <output>
      {`${session.loading ? 'loading' : 'ready'}:close=${session.canCloseCash ? 'yes' : 'no'}:close-any=${session.canCloseAnyCash ? 'yes' : 'no'}`}
    </output>
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

  it('cleans up Echo and the query cache on session expiry without refreshing csrf cookies', async () => {
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
    expect(invalidateCsrfCookie).not.toHaveBeenCalled();
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

  it('does not treat generic reports.view as a usable report permission', async () => {
    vi.spyOn(apiClient, 'session').mockResolvedValue({
      id: 1,
      name: 'Operador reportes legado',
      email: 'reportes.legado@hospital.local',
      username: 'reportes.legado',
      active: true,
      roles: ['operador'],
      permissions: ['reports.view'],
      must_change_password: false,
    });

    render(<PermissionProbe />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('ready:reports=no:operational=no')).toBeInTheDocument());
  });

  it('treats cash.close_any as a usable close permission for supervisor rescue', async () => {
    vi.spyOn(apiClient, 'session').mockResolvedValue({
      id: 1,
      name: 'Supervisor caja',
      email: 'supervisor.caja@hospital.local',
      username: 'supervisor.caja',
      active: true,
      roles: ['supervisor'],
      permissions: ['cash.view', 'cash.close_any'],
      must_change_password: false,
    });

    render(<CashPermissionProbe />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('ready:close=yes:close-any=yes')).toBeInTheDocument());
  });
});
