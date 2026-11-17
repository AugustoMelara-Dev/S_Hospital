import { describe, expect, it, vi } from 'vitest';
import { api, ApiError, newIdempotencyKey, setApiHandlers } from './api';
import { apiError, mockApi, reply } from '@/test/mockApi';

describe('api client', () => {
  it('sends credentials and X-Requested-With only on non-GET', async () => {
    const m = mockApi({ 'GET /ping': { ok: 1 }, 'POST /ping': reply(201, { ok: 2 }) });
    await api.get('/ping');
    await api.post('/ping', { a: 1 });
    const [get, post] = m.calls();
    expect(get?.headers['x-requested-with']).toBeUndefined();
    expect(post?.headers['x-requested-with']).toBe('shospital');
    expect(post?.headers['content-type']).toBe('application/json');
    expect(post?.body).toEqual({ a: 1 });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
  });

  it('serialises query params and skips empty values', async () => {
    const m = mockApi({ 'GET /invoices': { items: [], page: 1, per_page: 25, total: 0 } });
    await api.get('/invoices', { search: 'ana', status: undefined, pending: true, page: 2, empty: '' });
    const q = m.calls()[0]?.query;
    expect(q?.get('search')).toBe('ana');
    expect(q?.get('pending')).toBe('1');
    expect(q?.get('page')).toBe('2');
    expect(q?.has('status')).toBe(false);
    expect(q?.has('empty')).toBe(false);
  });

  it('adds an Idempotency-Key when requested and keeps an explicit one', async () => {
    const m = mockApi({ 'POST /invoices': reply(201, { id: 1 }) });
    await api.post('/invoices', {}, { idempotent: true });
    await api.post('/invoices', {}, { idempotencyKey: 'fixed-key' });
    const [a, b] = m.calls();
    expect(a?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(b?.headers['idempotency-key']).toBe('fixed-key');
  });

  it('parses the error envelope into ApiError', async () => {
    mockApi({
      'POST /invoices': apiError(422, 'validation_error', 'Revise los datos.', { patient_name: 'Ingrese el nombre del paciente.' }),
    });
    const err = await api.post('/invoices', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'validation_error', message: 'Revise los datos.' });
    expect((err as ApiError).fields.patient_name).toBe('Ingrese el nombre del paciente.');
  });

  it('routes 401 and password_change_required to the global handlers', async () => {
    const onUnauthorized = vi.fn();
    const onPasswordChangeRequired = vi.fn();
    setApiHandlers({ onUnauthorized, onPasswordChangeRequired });
    mockApi({
      'GET /a': apiError(401, 'unauthenticated', 'Sin sesión'),
      'GET /b': apiError(403, 'password_change_required', 'Cambie su contraseña'),
      'GET /c': apiError(401, 'unauthenticated', 'Sin sesión'),
    });
    await expect(api.get('/a')).rejects.toThrow();
    await expect(api.get('/b')).rejects.toThrow();
    await expect(api.get('/c', undefined, { skipAuthRedirect: true })).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onPasswordChangeRequired).toHaveBeenCalledTimes(1);
  });

  it('maps network failures to a Spanish message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'network_error', status: 0 });
  });

  it('generates RFC4122 v4 keys without crypto.randomUUID', () => {
    const k = newIdempotencyKey();
    expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(k);
  });
});
