import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('../api/base', () => ({
  apiClient: {
    request: (...args: unknown[]) => requestMock(...args),
    url: (path: string) => path,
  },
}));

vi.mock('laravel-echo', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { disconnect: vi.fn(), leaveChannel: vi.fn() };
    }),
  };
});

vi.mock('pusher-js', () => {
  return {
    default: vi.fn(),
  };
});

const DISABLED_CONFIG = {
  driver: 'null' as const,
  enabled: false,
  key: '',
  cluster: '',
  host: '',
  port: 0,
  scheme: 'http' as const,
  useTLS: false,
  authEndpoint: '',
  channels: {
    invoices: 'invoices' as const,
    cash: 'cash' as const,
    payments: 'payments' as const,
    settings: 'settings' as const,
    backups: 'backups' as const,
  },
};

async function loadEcho() {
  vi.resetModules();
  const mod = await import('./echo');

  return mod.getEcho;
}

describe('lib/realtime/echo', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the config endpoint reports broadcasting is disabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: DISABLED_CONFIG }),
    } as Response);

    const getEcho = await loadEcho();
    const echo = await getEcho();
    expect(echo).toBeNull();
  });

  it('resets configPromise when the config fetch throws, so the next call retries', async () => {
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('LAN apagada');
      }

      return {
        ok: true,
        json: async () => ({ data: DISABLED_CONFIG }),
      } as Response;
    });

    const getEcho = await loadEcho();

    const first = await getEcho();
    expect(first).toBeNull();

    const second = await getEcho();
    expect(second).toBeNull();
    expect(attempts).toBe(2);
  });
});
