import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, isPermissionDeniedError, isSessionExpiredError, resetCsrfCache, resetRequestChain, resolveApiBaseUrl, userSafeErrorMessage } from './base';

function locationFor(hostname: string): Pick<Location, 'hostname'> {
  return { hostname };
}

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetRequestChain();
    resetCsrfCache();
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

    expect(message).toMatch(/factura o el pago ya cambió de estado/i);
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

  it('lists every validation error from a 422 response with human-readable field labels', () => {
    const error = new ApiError('Fallo de validacion.', 422, {
      patient_name: ['Ingrese el nombre del paciente.'],
      'items.0.quantity': ['La cantidad debe ser mayor a cero.'],
      'items.1.service_id': ['El servicio no existe.', 'No es facturable.'],
    });

    const message = userSafeErrorMessage(error, 'No se pudo emitir la factura.');

    expect(message).toMatch(/patient name: Ingrese el nombre del paciente\./i);
    expect(message).toMatch(/items #1 \(quantity\): La cantidad debe ser mayor a cero\./i);
    expect(message).toMatch(/items #2 \(service id\): El servicio no existe\., No es facturable\./i);
    expect(message).not.toMatch(/patient_name/);
    expect(message).not.toMatch(/items\.0\.quantity/);
  });

  it('labels cash session validation errors as caja for cashiers', () => {
    const message = userSafeErrorMessage(
      new ApiError('Revise los datos del formulario.', 422, {
        cash_session: ['Ya existe una caja abierta en esta terminal. Cierre la caja actual antes de abrir otra.'],
      }),
      'No se pudo abrir caja.',
    );

    expect(message).toMatch(/Caja: Ya existe una caja abierta/i);
    expect(message).not.toMatch(/cash_session|cash session/i);
  });

  it('falls back to a generic message when a 422 has no validation payload', () => {
    const message = userSafeErrorMessage(new ApiError('No se pudo guardar.', 422), 'fallback');

    expect(message).toBe('No se pudo guardar.');
  });

  it('shows the lockout guidance when the backend responds 423', () => {
    const message = userSafeErrorMessage(new ApiError('', 423), 'fallback');

    expect(message).toMatch(/cuenta bloqueada por intentos fallidos/i);
    expect(message).toMatch(/15 minutos/i);
  });

  it('keeps the permission denied message stable for 403 responses', () => {
    const error = new ApiError('Forbidden', 403);
    const message = userSafeErrorMessage(error, 'fallback');

    expect(message).toMatch(/no tiene permiso para esta acci/i);
    expect(isPermissionDeniedError(error)).toBe(true);
    expect(isPermissionDeniedError(new ApiError('teapot', 418))).toBe(false);
    expect(isSessionExpiredError(new ApiError('teapot', 401))).toBe(true);
  });

  it('still treats 5xx errors as server-side without leaking stack traces', () => {
    const message = userSafeErrorMessage(
      new ApiError('SQLSTATE[HY000]: General error: 7 (SQL) at /var/www/html/app/Http/Controllers/X.php:42', 500),
      'fallback',
    );

    expect(message).toMatch(/el servidor local no pudo completar la operación/i);
    expect(message).not.toMatch(/servidor LAN/i);
    expect(message).not.toMatch(/SQLSTATE/);
  });

  it('stores safe local support evidence when the local server is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed to fetch DB_PASSWORD=secret'));

    await expect(apiClient.request('/api/health')).rejects.toThrow(/servidor local/i);
    await expect(apiClient.request('/api/health')).rejects.not.toThrow(/failed to fetch|DB_PASSWORD|secret/i);

    const stored = JSON.parse(window.localStorage.getItem('hospital_client_issue_log') ?? '[]') as Array<{
      action: string;
      module: string;
      safe_message: string;
    }>;

    expect(stored[0]).toMatchObject({
      action: 'GET /api/health',
      module: 'api',
    });
    expect(stored[0].safe_message).toMatch(/servidor local/i);
    expect(stored[0].safe_message).not.toMatch(/servidor LAN/i);
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
      .rejects.toThrow(/servidor local/i);

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
    for (let i = 0; i < 10 && !resolveFirstPost; i += 1) {
      await Promise.resolve();
    }
    expect(resolveFirstPost).toBeDefined();

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

  it('caches the CSRF cookie request for the second mutating call', async () => {
    document.cookie = 'XSRF-TOKEN=test-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
    });

    await apiClient.request('/api/first', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    await apiClient.request('/api/second', { method: 'POST', body: JSON.stringify({ b: 2 }) });

    const csrfCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('/sanctum/csrf-cookie'));

    expect(csrfCalls).toHaveLength(1);
  });

  it('expires the cached CSRF cookie request after ten minutes', async () => {
    vi.useFakeTimers();
    try {
      resetCsrfCache();
      const csrf = vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValue(undefined);

      vi.setSystemTime(new Date('2026-06-18T08:00:00-06:00'));
      await apiClient.csrf();

      vi.setSystemTime(new Date('2026-06-18T08:09:59-06:00'));
      await apiClient.csrf();
      expect(csrf).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date('2026-06-18T08:10:00-06:00'));
      await apiClient.csrf();
      expect(csrf).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes the CSRF cookie when a mutating request receives 419', async () => {
    document.cookie = 'XSRF-TOKEN=test-token';
    let postAttempts = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      postAttempts += 1;
      if (postAttempts === 1) {
        return {
          ok: false,
          status: 419,
          json: async () => ({ message: 'CSRF token mismatch.' }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
    });

    await expect(apiClient.request('/api/payments', { method: 'POST', body: JSON.stringify({ amount: '1.00' }) }))
      .resolves.toEqual({ data: 'ok' });

    const csrfCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('/sanctum/csrf-cookie'));

    expect(csrfCalls).toHaveLength(2);
    expect(postAttempts).toBe(2);
  });

  it('logs validation issues in the local support log without leaking raw field names', async () => {
    document.cookie = 'XSRF-TOKEN=test-token';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/sanctum/csrf-cookie')) {
        return { ok: true, json: async () => ({}) } as Response;
      }

      return {
        ok: false,
        status: 422,
        statusText: 'Unprocessable',
        json: async () => ({
          message: 'The given data was invalid.',
          errors: {
            patient_name: ['Ingrese el nombre del paciente.'],
            'items.0.quantity': ['La cantidad debe ser mayor a cero.'],
          },
        }),
      } as Response;
    });

    await expect(apiClient.request('/api/invoices', { method: 'POST', body: JSON.stringify({}) })).rejects.toBeInstanceOf(ApiError);

    const stored = JSON.parse(window.localStorage.getItem('hospital_client_issue_log') ?? '[]') as Array<{
      action: string;
      module: string;
      safe_message: string;
    }>;

    expect(stored[0]).toMatchObject({
      action: 'POST /api/invoices',
      module: 'api',
    });
    expect(stored[0].safe_message).toMatch(/Revise los datos del formulario\./i);
  });

  describe('session expired multi-subscriber registry', () => {
    it('notifies every registered handler when a 419 fires', async () => {
      const a = vi.fn();
      const b = vi.fn();
      const unsubscribeA = apiClient.onSessionExpired(a);
      const unsubscribeB = apiClient.onSessionExpired(b);

      resetCsrfCache();
      resetRequestChain();

      const csrf = vi
        .spyOn(apiClient, 'fetchCsrfCookie')
        .mockResolvedValueOnce(undefined);

      vi.spyOn(window, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url.endsWith('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true, status: 204, json: async () => ({}) } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 419,
          statusText: 'CSRF',
          json: async () => ({ message: 'CSRF token mismatch.' }),
        } as Response);
      });

      await expect(apiClient.request('/api/invoices', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

      expect(a).toHaveBeenCalled();
      expect(b).toHaveBeenCalled();

      unsubscribeA();
      unsubscribeB();
      csrf.mockRestore();
    });

    it('returns an unsubscribe function that removes the handler', async () => {
      const a = vi.fn();
      const unsubscribe = apiClient.onSessionExpired(a);
      unsubscribe();

      resetCsrfCache();
      resetRequestChain();
      vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValueOnce(undefined);
      vi.spyOn(window, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url.endsWith('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true, status: 204, json: async () => ({}) } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauth',
          json: async () => ({ message: 'Unauthenticated.' }),
        } as Response);
      });

      await expect(apiClient.request('/api/invoices', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

      expect(a).not.toHaveBeenCalled();
    });

    it('does not refresh csrf cookies after a read-only 401', async () => {
      const handler = vi.fn();
      const unsubscribe = apiClient.onSessionExpired(handler);
      resetCsrfCache();
      resetRequestChain();

      const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauth',
        json: async () => ({ message: 'Unauthenticated.' }),
      } as Response);

      await expect(apiClient.request('/api/cash-sessions/current')).rejects.toBeInstanceOf(ApiError);

      const csrfCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/sanctum/csrf-cookie'));

      expect(handler).toHaveBeenCalled();
      expect(csrfCalls).toHaveLength(0);
      unsubscribe();
    });

    it('survives a handler that throws', async () => {
      const a = vi.fn(() => {
        throw new Error('handler bug');
      });
      const b = vi.fn();
      const unsubscribeA = apiClient.onSessionExpired(a);
      const unsubscribeB = apiClient.onSessionExpired(b);

      resetCsrfCache();
      resetRequestChain();
      vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValueOnce(undefined);
      vi.spyOn(window, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url.endsWith('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true, status: 204, json: async () => ({}) } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauth',
          json: async () => ({ message: 'Unauthenticated.' }),
        } as Response);
      });

      await expect(apiClient.request('/api/invoices', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

      expect(b).toHaveBeenCalled();
      unsubscribeA();
      unsubscribeB();
    });

    it('invalidateSession clears the CSRF cache', async () => {
      resetCsrfCache();
      vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValueOnce(undefined);
      await apiClient.csrf();
      // After this call the cache has a fresh promise.
      apiClient.invalidateSession();
      // The next call must re-fetch.
      const csrf2 = vi
        .spyOn(apiClient, 'fetchCsrfCookie')
        .mockResolvedValueOnce(undefined);
      await apiClient.csrf();
      expect(csrf2).toHaveBeenCalled();
    });
  });

  describe('per-request timeout via AbortController', () => {
    it('preserves an external cancellation as AbortError instead of reporting a timeout', async () => {
      const controller = new AbortController();
      vi.spyOn(window, 'fetch').mockImplementation((_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal as AbortSignal | null;
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
      );

      const pending = apiClient.request('/api/services?search=glu', {
        signal: controller.signal,
      });
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('aborts the request and surfaces a timeout message when the server hangs', async () => {
      resetCsrfCache();
      resetRequestChain();
      vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValueOnce(undefined);

      const fetchSpy = vi
        .spyOn(window, 'fetch')
        .mockImplementation((_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal as AbortSignal | null;
            if (signal) {
              signal.addEventListener('abort', () => {
                reject(new DOMException('aborted', 'AbortError'));
              });
            }
          }),
        );

      const start = Date.now();
      await expect(
        apiClient.request('/api/invoices', {
          method: 'POST',
          body: JSON.stringify({}),
          timeout: 50,
        }),
      ).rejects.toBeInstanceOf(ApiError);
      const elapsed = Date.now() - start;

      expect(fetchSpy).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(1000);
    });

    it('keeps the timeout active when a mutating request retries after 419', async () => {
      resetCsrfCache();
      resetRequestChain();

      let postAttempts = 0;
      vi.spyOn(apiClient, 'fetchCsrfCookie').mockResolvedValue(undefined);
      vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        if (url.endsWith('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true, status: 204, json: async () => ({}) } as Response);
        }

        postAttempts += 1;
        if (postAttempts === 1) {
          return Promise.resolve({
            ok: false,
            status: 419,
            statusText: 'CSRF',
            json: async () => ({ message: 'CSRF token mismatch.' }),
          } as Response);
        }

        return new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal as AbortSignal | null;
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });

      const start = Date.now();
      await expect(
        apiClient.request('/api/payments', {
          method: 'POST',
          body: JSON.stringify({ amount: '1.00' }),
          timeout: 50,
        }),
      ).rejects.toBeInstanceOf(ApiError);
      const elapsed = Date.now() - start;

      expect(postAttempts).toBe(2);
      expect(elapsed).toBeLessThan(1000);
    });

    it('aborts downloads when the server never responds', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(window, 'fetch').mockImplementation((_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal as AbortSignal | null;
            signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
        );

        const pending = apiClient.download('/api/reports/pdf?date=2026-06-15', { timeout: 50 });
        const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
        await vi.advanceTimersByTimeAsync(50);

        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Idempotency-Key on mutations', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      window.localStorage.clear();
      resetRequestChain();
      resetCsrfCache();
    });

    it('attaches a UUID Idempotency-Key header to every POST', async () => {
      document.cookie = 'XSRF-TOKEN=test-token';
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
        const url = String(input);
        if (url.includes('/sanctum/csrf-cookie')) {
          return { ok: true, json: async () => ({}) } as Response;
        }

        return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
      });

      await apiClient.request('/api/invoices', { method: 'POST', body: JSON.stringify({ a: 1 }) });

      const invoiceCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/invoices'));
      expect(invoiceCall).toBeDefined();
      const headers = new Headers((invoiceCall?.[1] as RequestInit | undefined)?.headers);
      const key = headers.get('Idempotency-Key');
      expect(key).toBeTruthy();
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('uses a different Idempotency-Key per distinct mutation', async () => {
      document.cookie = 'XSRF-TOKEN=test-token';
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/sanctum/csrf-cookie')) {
          return { ok: true, json: async () => ({}) } as Response;
        }

        return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
      });

      await apiClient.request('/api/invoices', { method: 'POST', body: JSON.stringify({ a: 1 }) });
      await apiClient.request('/api/payments', { method: 'POST', body: JSON.stringify({ b: 2 }) });

      const keys = fetchMock.mock.calls
        .map(([url, init]) => ({
          url: String(url),
          key: new Headers((init as RequestInit | undefined)?.headers).get('Idempotency-Key'),
        }))
        .filter(({ key }) => Boolean(key));

      expect(keys).toHaveLength(2);
      expect(keys[0]?.key).not.toBe(keys[1]?.key);
    });

    it('reuses the same Idempotency-Key on a 419 auto-retry so the backend can de-duplicate', async () => {
      document.cookie = 'XSRF-TOKEN=test-token';
      let postAttempts = 0;
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
        const url = String(input);
        if (url.includes('/sanctum/csrf-cookie')) {
          return { ok: true, json: async () => ({}) } as Response;
        }

        postAttempts += 1;
        if (postAttempts === 1) {
          return {
            ok: false,
            status: 419,
            json: async () => ({ message: 'CSRF token mismatch.' }),
          } as Response;
        }

        return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
      });

      await apiClient.request('/api/invoices', { method: 'POST', body: JSON.stringify({ a: 1 }) });

      const postKeys = fetchMock.mock.calls
        .filter(([url]) => !String(url).includes('/sanctum/csrf-cookie'))
        .map(([, init]) => new Headers((init as RequestInit | undefined)?.headers).get('Idempotency-Key'));

      expect(postAttempts).toBe(2);
      expect(postKeys).toHaveLength(2);
      expect(postKeys[0]).toBeTruthy();
      expect(postKeys[0]).toBe(postKeys[1]);
    });

    it('does not attach an Idempotency-Key to GET requests', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ data: 'ok' }) } as Response;
      });

      await apiClient.request('/api/invoices');

      const [, init] = fetchMock.mock.calls[0] ?? [];
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      expect(headers.get('Idempotency-Key')).toBeNull();
    });
  });
});
