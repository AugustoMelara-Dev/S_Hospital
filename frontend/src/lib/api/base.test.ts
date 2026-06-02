import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, resetRequestChain, resolveApiBaseUrl, userSafeErrorMessage } from './base';

function locationFor(hostname: string): Pick<Location, 'hostname'> {
  return { hostname };
}

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetRequestChain();
  });

  it('uses same-origin API routes by default', () => {
    expect(resolveApiBaseUrl('', locationFor('192.168.1.10'))).toBe('');
  });

  it('drops a localhost build URL when the app is opened by IP', () => {
    expect(resolveApiBaseUrl('http://localhost:8000', locationFor('127.0.0.1'))).toBe('');
    expect(resolveApiBaseUrl('http://localhost:8000', locationFor('192.168.1.10'))).toBe('');
  });

  it('keeps localhost for same-host development', () => {
    expect(resolveApiBaseUrl('http://localhost:8000/', locationFor('localhost'))).toBe('http://localhost:8000');
  });

  it('keeps a non-loopback remote API URL when explicitly configured', () => {
    expect(resolveApiBaseUrl('http://192.168.1.10:8000/', locationFor('192.168.1.20'))).toBe('http://192.168.1.10:8000');
  });

  it('shows operational instructions for cashbox conflicts without exposing fields', () => {
    const message = userSafeErrorMessage(
      new ApiError('cash_session_id: La caja seleccionada esta cerrada.', 409),
      'No se pudo registrar el pago.',
    );

    expect(message).toMatch(/caja esta cerrada o cambio de estado/i);
    expect(message).toMatch(/revise caja e historial/i);
    expect(message).not.toMatch(/cash_session_id/i);
  });

  it('warns users to check history before repeating duplicated billing operations', () => {
    const message = userSafeErrorMessage(
      new ApiError('duplicate payment already registered', 409),
      'No se pudo registrar el pago.',
    );

    expect(message).toMatch(/factura o el pago ya cambio de estado/i);
    expect(message).toMatch(/revise historial antes de repetir/i);
    expect(message).not.toMatch(/duplicate|already/i);
  });

  it('keeps backup restore conflicts non-technical', () => {
    const message = userSafeErrorMessage(
      new ApiError('backup restore lock conflict', 409),
      'No se pudo restaurar el respaldo.',
    );

    expect(message).toMatch(/respaldo cambio de estado/i);
    expect(message).toMatch(/pida soporte antes de restaurar/i);
    expect(message).not.toMatch(/lock|conflict/i);
  });

  it('stores safe local support evidence when the LAN server is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed to fetch DB_PASSWORD=secret'));

    await expect(apiClient.request('/api/health')).rejects.toThrow(/servidor LAN/i);

    const stored = JSON.parse(window.localStorage.getItem('hospital_client_issue_log') ?? '[]') as Array<{
      action: string;
      module: string;
      safe_message: string;
    }>;

    expect(stored[0]).toMatchObject({
      action: 'GET /api/health',
      module: 'api',
    });
    expect(stored[0].safe_message).toMatch(/servidor LAN/i);
    expect(stored[0].safe_message).toMatch(/failed to fetch/i);
    expect(stored[0].safe_message).not.toMatch(/DB_PASSWORD|secret/i);
  });

  it('records sanitized browser network details for mutating requests', async () => {
    document.cookie = 'XSRF-TOKEN=test-token';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      throw new Error('LAN apagada token=hidden');
    });

    await expect(apiClient.request('/api/payments', { method: 'POST', body: JSON.stringify({ amount: '1.00' }) }))
      .rejects.toThrow(/servidor LAN/i);

    const stored = JSON.parse(window.localStorage.getItem('hospital_client_issue_log') ?? '[]') as Array<{
      action: string;
      module: string;
      safe_message: string;
    }>;

    expect(stored[0]).toMatchObject({
      action: 'POST /api/payments',
      module: 'api',
    });
    expect(stored[0].safe_message).toMatch(/LAN apagada/i);
    expect(stored[0].safe_message).not.toMatch(/token|hidden/i);
  });

  it('allows GET requests to run concurrently', async () => {
    let resolveSlow: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/api/slow')) {
        return new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        });
      }

      return {
        ok: true,
        json: async () => ({ data: url }),
      } as Response;
    });

    const slow = apiClient.request('/api/slow');
    await Promise.resolve();
    const fast = apiClient.request('/api/fast');
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(fast).resolves.toEqual({ data: '/api/fast' });

    resolveSlow?.({
      ok: true,
      json: async () => ({ data: 'slow' }),
    } as Response);
    await expect(slow).resolves.toEqual({ data: 'slow' });
  });

  it('keeps mutating requests serialized for csrf safety', async () => {
    document.cookie = 'XSRF-TOKEN=test-token';
    let resolveFirstPost: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      if (url.includes('/api/first')) {
        return new Promise<Response>((resolve) => {
          resolveFirstPost = resolve;
        });
      }

      return {
        ok: true,
        json: async () => ({ data: url }),
      } as Response;
    });

    const first = apiClient.request('/api/first', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    await Promise.resolve();
    await Promise.resolve();
    const second = apiClient.request('/api/second', { method: 'POST', body: JSON.stringify({ b: 2 }) });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/api/second'))).toHaveLength(0);

    resolveFirstPost?.({
      ok: true,
      json: async () => ({ data: 'first' }),
    } as Response);
    await expect(first).resolves.toEqual({ data: 'first' });
    await expect(second).resolves.toEqual({ data: '/api/second' });
  });
});
