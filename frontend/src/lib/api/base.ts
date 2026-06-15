import { PERMISSION_DENIED_MESSAGE, logClientIssue, safeClientMessage } from '../support/clientIssueLog';
import { invalidateCsrfCookie } from '../csrf';

let forceLogoutHandler: (() => void) | null = null;

const sessionExpiredHandlers = new Set<() => void>();
let requestChain: Promise<unknown> = Promise.resolve();

const CSRF_CACHE_TTL_MS = 10 * 60 * 1000;
let csrfCache: { fetchedAt: number; promise: Promise<void> } | null = null;

const DEFAULT_GET_TIMEOUT_MS = 10_000;
const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;

type ApiRequestInit = RequestInit & {
  timeout?: number;
  /**
   * Force a specific Idempotency-Key. When omitted, the apiClient generates
   * a fresh UUID per mutation (POST/PUT/PATCH/DELETE). Providing an explicit
   * value lets the caller reuse the same key across retries of the same
   * logical operation (e.g. a 419 retry that the caller already requested).
   */
  idempotencyKey?: string;
};

export function resetRequestChain() {
  requestChain = Promise.resolve();
}

/**
 * Generate a stable per-attempt UUID. We prefer the global crypto.randomUUID
 * but fall back to a typed-array implementation for browsers/test environments
 * that don't expose it.
 */
function newIdempotencyKey(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 v4 layout
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function resetCsrfCache() {
  csrfCache = null;
}

function notifySessionExpired(): void {
  for (const handler of sessionExpiredHandlers) {
    try {
      handler();
    } catch {
      // A handler that throws must not break the others.
    }
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly validationErrors?: Record<string, string[]>;

  constructor(message: string, status: number, validationErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 419);
}

export function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function conflictSafeMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (/caja|cash[_\s-]?session/.test(normalized)) {
    return 'La caja esta cerrada o cambio de estado. Revise Caja e Historial antes de repetir facturas o cobros.';
  }

  if (/factura|invoice|pago|payment|duplic|already|ya registrada|ya registrado/.test(normalized)) {
    return 'La factura o el pago ya cambió de estado. Revise Historial antes de repetir la operación.';
  }

  if (/respaldo|backup|restore|restaur/.test(normalized)) {
    return 'El respaldo cambio de estado. Actualice Respaldos y pida soporte antes de restaurar o repetir.';
  }

  return 'La accion no se pudo completar porque el estado actual cambio. Actualice la pantalla e intente de nuevo.';
}

export function userSafeErrorMessage(error: unknown, fallback: string): string {
  if (isSessionExpiredError(error)) {
    return 'Sesión vencida. Vuelva a iniciar sesión para continuar.';
  }

  if (error instanceof ApiError && error.status === 423) {
    return 'Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.';
  }

  if (error instanceof ApiError && error.status === 403) {
    return PERMISSION_DENIED_MESSAGE;
  }

  if (error instanceof ApiError && error.status === 422) {
    return formatValidationMessage(error);
  }

  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiados intentos. Por seguridad local LAN, su acceso ha sido bloqueado temporalmente. Por favor espere 60 segundos antes de intentar de nuevo.';
  }

  if (error instanceof ApiError && error.status === 409) {
    return conflictSafeMessage(error.message);
  }

  if (error instanceof ApiError && error.status >= 500) {
    return 'El servidor LAN no pudo completar la operación. Revise el servidor local e intente de nuevo.';
  }

  if (
    error instanceof Error &&
    error.message.trim() !== '' &&
    !/unauthenticated|sql|exception|stack|trace|laravel/i.test(error.message)
  ) {
    return error.message;
  }

  return fallback;
}

function formatValidationMessage(error: ApiError): string {
  if (!error.validationErrors || Object.keys(error.validationErrors).length === 0) {
    return error.message || 'Revise los datos del formulario.';
  }

  const entries: string[] = [];

  for (const [field, messages] of Object.entries(error.validationErrors)) {
    const cleanMessages = (messages ?? []).filter((m): m is string => Boolean(m && m.trim()));
    if (cleanMessages.length === 0) {
      continue;
    }
    const label = fieldLabel(field);
    entries.push(label ? `${label}: ${cleanMessages.join(', ')}` : cleanMessages.join(', '));
  }

  if (entries.length === 0) {
    return error.message || 'Revise los datos del formulario.';
  }

  return entries.join('\n');
}

function fieldLabel(field: string): string {
  if (!field.includes('.')) {
    return humanizeFieldName(field);
  }

  const [parent, child, ...rest] = field.split('.');

  if (child === undefined) {
    return humanizeFieldName(parent ?? field);
  }

  if (/^\d+$/.test(child)) {
    const detail = rest.map(humanizeFieldName).filter(Boolean).join(' ');

    return detail
      ? `${humanizeFieldName(parent ?? field)} #${Number(child) + 1} (${detail})`
      : `${humanizeFieldName(parent ?? field)} #${Number(child) + 1}`;
  }

  const detail = [child, ...rest].map(humanizeFieldName).filter(Boolean).join(' ');

  return `${humanizeFieldName(parent ?? field)} (${detail})`;
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cookieValue(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export function resolveApiBaseUrl(
  configuredUrl: string,
  currentLocation: Pick<Location, 'hostname'> | undefined = typeof window === 'undefined' ? undefined : window.location,
): string {
  const normalizedUrl = configuredUrl.trim().replace(/\/$/, '');

  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

    if (
      currentLocation?.hostname &&
      loopbackHosts.has(parsedUrl.hostname) &&
      currentLocation.hostname !== parsedUrl.hostname
    ) {
      return '';
    }
  } catch {
    return normalizedUrl;
  }

  return normalizedUrl;
}

function networkError(error?: unknown): ApiError {
  const baseMessage = 'No se pudo conectar con el servidor LAN. Revise que el servidor local este encendido y vuelva a intentar.';
  const rawDetail = error instanceof Error ? error.message : error === undefined ? '' : String(error);
  const safeDetail = safeClientMessage(rawDetail);
  const message = safeDetail ? `${baseMessage} Detalle seguro del navegador: ${safeDetail}` : baseMessage;

  return new ApiError(message, 0);
}

function recordApiIssue(error: ApiError, action: string): never {
  logClientIssue(error, {
    action,
    module: 'api',
  });

  throw error;
}

function enqueueRequest<T>(operation: () => Promise<T>): Promise<T> {
  const next = requestChain
    .catch(() => undefined)
    .then(operation);
  requestChain = next.catch(() => undefined);

  return next;
}

export const apiClient = {
  baseUrl: resolveApiBaseUrl(configuredBaseUrl),

  // Multi-subscriber registry. StrictMode in dev can mount a hook
  // twice; the previous single-slot design made the second cleanup
  // null the handler even though the first mount was still alive.
  onSessionExpired(handler: (() => void) | null): () => void {
    if (handler === null) {
      return () => undefined;
    }
    sessionExpiredHandlers.add(handler);
    return () => {
      sessionExpiredHandlers.delete(handler);
    };
  },

  onForceLogout(handler: (() => void) | null): () => void {
    if (handler === null) {
      forceLogoutHandler = null;

      return () => undefined;
    }
    forceLogoutHandler = handler;

    return () => {
      if (forceLogoutHandler === handler) {
        forceLogoutHandler = null;
      }
    };
  },

  // Called by useHospitalSession on logout (and after a 401/419) to
  // wipe the cached CSRF cookie promise. The next login gets a fresh
  // token from /sanctum/csrf-cookie instead of reusing the previous
  // user's token from the 30-minute cache window.
  invalidateSession(): void {
    resetCsrfCache();
  },

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  },

  async systemHealth(): Promise<{ data: import('./types').OperationalHealth }> {
    return this.request<{ data: import('./types').OperationalHealth }>('/api/system/health');
  },

  async csrf(): Promise<void> {
    const now = Date.now();

    if (csrfCache && now - csrfCache.fetchedAt < CSRF_CACHE_TTL_MS) {
      return csrfCache.promise;
    }

    const pending = this.fetchCsrfCookie();
    csrfCache = { fetchedAt: now, promise: pending };

    try {
      await pending;
    } catch (error) {
      csrfCache = null;
      throw error;
    }
  },

  async fetchCsrfCookie(): Promise<void> {
    let response: Response;

    try {
      response = await fetch(this.url('/sanctum/csrf-cookie'), {
        credentials: 'include',
      });
    } catch (err) {
      recordApiIssue(networkError(err), 'csrf_network');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        notifySessionExpired();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), 'csrf_session');
      }

      recordApiIssue(
        new ApiError('No se pudo preparar la sesión segura. Revise el servidor local e intente de nuevo.', response.status),
        'csrf_prepare',
      );
    }
  },

  async request<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
    const method = options.method?.toUpperCase() ?? 'GET';

    if (method === 'GET' || method === 'HEAD') {
      return this.sendRequest<T>(path, options);
    }

    // Attach a stable per-attempt Idempotency-Key to every mutation so the
    // backend middleware can de-duplicate retries. If the caller already
    // provided a key (e.g. a manually retried submit), reuse it.
    if (!options.idempotencyKey) {
      options = { ...options, idempotencyKey: newIdempotencyKey() };
    }

    return enqueueRequest(() => this.sendRequest<T>(path, options));
  },

  async sendRequest<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
    const method = options.method?.toUpperCase() ?? 'GET';

    if (method !== 'GET' && method !== 'HEAD') {
      await this.csrf();
    }

    // Per-request timeout via AbortController. A hung connection used
    // to block the cashier indefinitely; the previous implementation
    // relied on the browser's own timeout (~minutes) and on no-fetch-
    // ever-resolving-pending query chains.
    const externalSignal = options.signal ?? null;
    const customTimeout = options.timeout;
    const timeoutMs =
      Number.isFinite(customTimeout) && Number(customTimeout) > 0
        ? Number(customTimeout)
        : method === 'GET' || method === 'HEAD'
          ? DEFAULT_GET_TIMEOUT_MS
          : DEFAULT_MUTATION_TIMEOUT_MS;

    // The Idempotency-Key must be present for any mutation so the server
    // middleware can de-duplicate. `request()` already assigns one for
    // POST/PUT/PATCH/DELETE; this is a defense-in-depth check.
    const idempotencyKey = method === 'GET' || method === 'HEAD' ? null : options.idempotencyKey ?? newIdempotencyKey();

    const send = async (): Promise<Response> => {
      const xsrfToken = method === 'GET' || method === 'HEAD' ? null : cookieValue('XSRF-TOKEN');
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      const relayAbort = () => controller.abort();

      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener('abort', relayAbort, { once: true });
        }
      }

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        };

        if (!(options.body instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }

        return await fetch(this.url(path), {
          ...options,
          credentials: 'include',
          signal: controller.signal,
          headers: {
            ...headers,
            ...options.headers,
          },
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          recordApiIssue(
            new ApiError(
              `La operación '${method} ${path}' excedió ${timeoutMs / 1000}s sin respuesta del servidor local. Revise la red.`,
              0,
            ),
            `${method} ${path}_timeout`,
          );
        }
        recordApiIssue(networkError(err), `${method} ${path}`);
      } finally {
        window.clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', relayAbort);
      }
    };

    let response = await send();

    // 419 (CSRF mismatch) auto-retry is ONLY safe when the same
    // Idempotency-Key is reused. We retry the request at most once
    // and re-send the SAME key so the backend middleware de-duplicates
    // and replays the original 2xx response instead of double-charging
    // the cashier.
    if (response.status === 419 && method !== 'GET' && method !== 'HEAD' && idempotencyKey) {
      resetCsrfCache();
      await this.csrf();
      response = await send();
    }

    if (response.status === 401) {
      // Force a fresh XSRF-TOKEN on the next request so the next
      // authenticated user does not reuse the previous session's
      // token. The cookie endpoint is best-effort: the primary
      // cleanup (session-expired notification) still runs.
      void invalidateCsrfCookie();
    }

    if (response.headers?.get('X-Force-Logout') === '1') {
      const handler = forceLogoutHandler;
      if (handler) {
        try {
          handler();
        } catch {
          // A throwing handler must not break the request error path.
        }
      }
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        errors?: Record<string, string[]>;
        message?: string;
      } | null;
      logClientIssue(
        new ApiError(error?.message ?? `HTTP ${response.status}`, response.status, error?.errors),
        { action: method, module: 'api', route: path },
      );

      if (response.status === 401) {
        notifySessionExpired();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), `${method} ${path}`);
      }

      if (response.status === 403) {
        recordApiIssue(new ApiError(PERMISSION_DENIED_MESSAGE, response.status), `${method} ${path}`);
      }

      if (response.status === 419) {
        notifySessionExpired();
        recordApiIssue(new ApiError('La sesión expiró. Actualice la pantalla e intente de nuevo.', response.status), `${method} ${path}`);
      }

      if (response.status === 422 && error?.errors) {
        const apiError = new ApiError(
          'Revise los datos del formulario.',
          response.status,
          error.errors,
        );
        logClientIssue(apiError, {
          action: `${method} ${path}`,
          module: 'api',
        });
        throw apiError;
      }

      if (response.status === 423) {
        recordApiIssue(
          new ApiError('Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.', response.status),
          `${method} ${path}`,
        );
      }

      recordApiIssue(new ApiError(error?.message ?? `HTTP ${response.status}`, response.status), `${method} ${path}`);
    }

    return (await response.json()) as T;
  },

  async download(path: string): Promise<Blob> {
    let response: Response;

    try {
      response = await fetch(this.url(path), {
        credentials: 'include',
        headers: {
          Accept: 'application/pdf, application/json, application/octet-stream, text/csv',
        },
      });
    } catch (err) {
      recordApiIssue(networkError(err), `DOWNLOAD ${path}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        notifySessionExpired();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), `DOWNLOAD ${path}`);
      }

      if (response.status === 403) {
        recordApiIssue(new ApiError(PERMISSION_DENIED_MESSAGE, response.status), `DOWNLOAD ${path}`);
      }

      if (response.status === 419) {
        notifySessionExpired();
        recordApiIssue(new ApiError('La sesión expiró. Actualice la pantalla e intente de nuevo.', response.status), `DOWNLOAD ${path}`);
      }

      if (response.status === 423) {
        recordApiIssue(
          new ApiError('Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.', response.status),
          `DOWNLOAD ${path}`,
        );
      }

      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      recordApiIssue(new ApiError(error?.message ?? `HTTP ${response.status}`, response.status), `DOWNLOAD ${path}`);
    }

    return response.blob();
  },
};
