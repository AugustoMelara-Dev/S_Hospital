import { vi } from 'vitest';
import type { Me, Permission } from '@/api/types';
import { PERMISSIONS } from '@/api/types';

export type MockRequest = {
  method: string;
  /** Path without query, e.g. "/api/invoices/12". */
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  headers: Record<string, string>;
  /** Parsed JSON body (or FormData / raw string). */
  body: unknown;
};

export type MockResponse = { status?: number; body?: unknown; headers?: Record<string, string> };

/** A handler returns a plain object (→ 200 JSON), a MockResponse via `reply()`, or throws. */
export type MockHandler = (req: MockRequest) => unknown | Promise<unknown>;

export type MockRoutes = Record<string, MockHandler | unknown>;

const REPLY = Symbol('reply');
type Reply = MockResponse & { [REPLY]: true };

/** Explicit status / headers: `reply(422, { error: {...} })`. */
export function reply(status: number, body?: unknown, headers?: Record<string, string>): Reply {
  return { [REPLY]: true, status, body, headers };
}

/** Shorthand for the SPEC error envelope. */
export function apiError(status: number, code: string, message: string, fields?: Record<string, string>): Reply {
  return reply(status, { error: { code, message, fields: fields ?? {} } });
}

function compile(pattern: string): { method: string; re: RegExp; keys: string[] } {
  const [method, rawPath] = pattern.includes(' ') ? (pattern.split(' ', 2) as [string, string]) : ['GET', pattern];
  const path = rawPath.startsWith('/api') ? rawPath : `/api${rawPath}`;
  const keys: string[] = [];
  const re = new RegExp(
    '^' +
      path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, k: string) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '$',
  );
  return { method: method.toUpperCase(), re, keys };
}

/**
 * Mocks `fetch` for API calls in tests.
 *
 * ```ts
 * const api = mockApi({
 *   'GET /auth/me': makeMe({ permissions: ['invoices.view'] }),
 *   'GET /invoices/:id': ({ params }) => ({ id: Number(params.id), ... }),
 *   'POST /invoices': ({ body, headers }) => reply(201, {...}),
 *   'POST /auth/login': apiError(423, 'login_locked', 'Demasiados intentos. Espere 15 minutos.'),
 * });
 * expect(api.calls('POST /invoices')[0].headers['idempotency-key']).toBeDefined();
 * ```
 * Keys are "METHOD /path" (the `/api` prefix is optional). Unmatched requests
 * answer 404 with the error envelope and are listed in `api.unmatched`.
 */
export function mockApi(routes: MockRoutes) {
  const compiled = Object.entries(routes).map(([pattern, handler]) => ({ pattern, handler, ...compile(pattern) }));
  const log: Array<MockRequest & { pattern: string | null }> = [];
  const unmatched: string[] = [];

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        /* keep raw */
      }
    }

    for (const r of compiled) {
      if (r.method !== method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1] ?? '');
      });
      const req: MockRequest = { method, path: url.pathname, query: url.searchParams, params, headers, body };
      log.push({ ...req, pattern: r.pattern });
      let out: unknown;
      try {
        out = typeof r.handler === 'function' ? await (r.handler as MockHandler)(req) : r.handler;
      } catch (e) {
        if (e && typeof e === 'object' && REPLY in e) out = e;
        else throw e;
      }
      const res: MockResponse = out && typeof out === 'object' && REPLY in out ? (out as Reply) : { status: 200, body: out };
      const status = res.status ?? 200;
      const isBlob = res.body instanceof Blob;
      const payload = status === 204 || res.body === undefined ? null : isBlob ? (res.body as Blob) : JSON.stringify(res.body);
      return new Response(payload, {
        status,
        headers: { 'Content-Type': isBlob ? (res.body as Blob).type : 'application/json', ...res.headers },
      });
    }

    unmatched.push(`${method} ${url.pathname}`);
    log.push({ method, path: url.pathname, query: url.searchParams, params: {}, headers, body, pattern: null });
    return new Response(JSON.stringify({ error: { code: 'not_found', message: `Sin mock: ${method} ${url.pathname}` } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return {
    /** All requests, or only those matching a route key. */
    calls: (pattern?: string) => (pattern ? log.filter((c) => c.pattern === pattern) : log),
    unmatched,
    restore: () => spy.mockRestore(),
  };
}

/** Test user factory. Defaults to the admin role with every permission. */
export function makeMe(overrides: Partial<Me> & { permissions?: Permission[] } = {}): Me {
  return {
    id: 1,
    name: 'Ana Martínez',
    username: 'amartinez',
    email: null,
    role: { code: 'admin', name: 'Administración' },
    permissions: [...PERMISSIONS],
    must_change_password: false,
    ...overrides,
  };
}
