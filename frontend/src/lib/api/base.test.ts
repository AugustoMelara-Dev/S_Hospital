import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, resetRequestChain, resolveApiBaseUrl } from './base';

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
    expect(stored[0].safe_message).not.toMatch(/DB_PASSWORD|secret/i);
  });
});
