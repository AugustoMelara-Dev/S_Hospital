import { PERMISSION_DENIED_MESSAGE, logClientIssue, safeClientMessage } from '../support/clientIssueLog';

let sessionExpiredHandler: (() => void) | null = null;
let requestChain: Promise<unknown> = Promise.resolve();

const CSRF_CACHE_TTL_MS = 30 * 60 * 1000;
let csrfCache: { fetchedAt: number; promise: Promise<void> } | null = null;

export function resetRequestChain() {
  requestChain = Promise.resolve();
}

export function resetCsrfCache() {
  csrfCache = null;
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
    return 'La factura o el pago ya cambio de estado. Revise Historial antes de repetir la operacion.';
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
    return 'El servidor LAN no pudo completar la operacion. Revise el servidor local e intente de nuevo.';
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

  const [parent, child] = field.split('.', 2);

  if (child === undefined) {
    return humanizeFieldName(parent ?? field);
  }

  if (/^\d+$/.test(child)) {
    return `${humanizeFieldName(parent ?? field)} #${Number(child) + 1}`;
  }

  return `${humanizeFieldName(parent ?? field)} (${humanizeFieldName(child)})`;
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

  onSessionExpired(handler: (() => void) | null): void {
    sessionExpiredHandler = handler;
  },

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
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
        sessionExpiredHandler?.();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), 'csrf_session');
      }

      recordApiIssue(
        new ApiError('No se pudo preparar la sesión segura. Revise el servidor local e intente de nuevo.', response.status),
        'csrf_prepare',
      );
    }
  },

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = options.method?.toUpperCase() ?? 'GET';

    if (method === 'GET' || method === 'HEAD') {
      return this.sendRequest<T>(path, options);
    }

    return enqueueRequest(() => this.sendRequest<T>(path, options));
  },

  async sendRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = options.method?.toUpperCase() ?? 'GET';

    if (method !== 'GET' && method !== 'HEAD') {
      await this.csrf();
    }

    const send = async (): Promise<Response> => {
      const xsrfToken = method === 'GET' || method === 'HEAD' ? null : cookieValue('XSRF-TOKEN');

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        };

        if (!(options.body instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }

        return await fetch(this.url(path), {
          ...options,
          credentials: 'include',
          headers: {
            ...headers,
            ...options.headers,
          },
        });
      } catch (err) {
        recordApiIssue(networkError(err), `${method} ${path}`);
      }
    };

    let response = await send();

    if (response.status === 419 && method !== 'GET' && method !== 'HEAD') {
      await this.csrf();
      response = await send();
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        errors?: Record<string, string[]>;
        message?: string;
      } | null;

      if (response.status === 401) {
        sessionExpiredHandler?.();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), `${method} ${path}`);
      }

      if (response.status === 403) {
        recordApiIssue(new ApiError(PERMISSION_DENIED_MESSAGE, response.status), `${method} ${path}`);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
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
          Accept: 'application/json, application/octet-stream, text/csv',
        },
      });
    } catch (err) {
      recordApiIssue(networkError(err), `DOWNLOAD ${path}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        sessionExpiredHandler?.();
        recordApiIssue(new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status), `DOWNLOAD ${path}`);
      }

      if (response.status === 403) {
        recordApiIssue(new ApiError(PERMISSION_DENIED_MESSAGE, response.status), `DOWNLOAD ${path}`);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
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
