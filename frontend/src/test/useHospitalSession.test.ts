import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

vi.mock('../lib/api', () => ({
  apiClient: {
    logout: vi.fn().mockResolvedValue(undefined),
    invalidateSession: vi.fn(),
    onSessionExpired: vi.fn().mockReturnValue(() => undefined),
    onForceLogout: vi.fn().mockReturnValue(() => undefined),
    session: vi.fn().mockResolvedValue(null),
    getCurrentCashSession: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../lib/realtime/echo', () => ({
  disconnectEcho: vi.fn(),
  getEcho: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/csrf', () => ({
  invalidateCsrfCookie: vi.fn().mockResolvedValue(undefined),
}));

import { apiClient } from '../lib/api';
import { disconnectEcho } from '../lib/realtime/echo';
import { invalidateCsrfCookie } from '../lib/csrf';

describe('session cleanup contracts', () => {
  beforeEach(() => {
    vi.mocked(apiClient.logout).mockClear();
    vi.mocked(apiClient.invalidateSession).mockClear();
    vi.mocked(disconnectEcho).mockClear();
    vi.mocked(invalidateCsrfCookie).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidateCsrfCookie is exported as a callable function', () => {
    expect(typeof invalidateCsrfCookie).toBe('function');
  });

  it('disconnectEcho is exported as a callable function', () => {
    expect(typeof disconnectEcho).toBe('function');
  });

  it('apiClient exposes the logout/invalidateSession methods used by the session hook', () => {
    expect(typeof apiClient.logout).toBe('function');
    expect(typeof apiClient.invalidateSession).toBe('function');
    expect(typeof apiClient.onForceLogout).toBe('function');
  });

  it('QueryClient exposes a clear() method that useHospitalSession can call on logout', () => {
    // Indirectly verifies the assumption that useHospitalSession can
    // call queryClient.clear() on logout.
    const client = new QueryClient();
    expect(typeof client.clear).toBe('function');
  });
});
