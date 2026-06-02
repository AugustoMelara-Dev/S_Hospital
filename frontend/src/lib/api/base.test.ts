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

    expect(message).toMatch(/el servidor LAN no pudo completar la operacion/i);
    expect(message).not.toMatch(/SQLSTATE/);
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
});
