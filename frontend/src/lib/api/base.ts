import { PERMISSION_DENIED_MESSAGE } from '../support/clientIssueLog';

let sessionExpiredHandler: (() => void) | null = null;
let requestChain: Promise<unknown> = Promise.resolve();

export function resetRequestChain() {
  requestChain = Promise.resolve();
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

export function userSafeErrorMessage(error: unknown, fallback: string): string {
  if (isSessionExpiredError(error)) {
    return 'Sesión vencida. Vuelva a iniciar sesión para continuar.';
  }

  if (error instanceof ApiError && error.status === 403) {
    return PERMISSION_DENIED_MESSAGE;
  }

  if (error instanceof ApiError && error.status === 422) {
    return error.message;
  }

  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiados intentos. Por seguridad local LAN, su acceso ha sido bloqueado temporalmente. Por favor espere 60 segundos antes de intentar de nuevo.';
  }

  if (error instanceof ApiError && error.status === 409) {
    return 'La accion no se pudo completar porque el estado actual cambio. Actualice la pantalla e intente de nuevo.';
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

function networkError(): ApiError {
  return new ApiError('No se pudo conectar con el servidor LAN. Revise que el servidor local este encendido y vuelva a intentar.', 0);
}

function enqueueRequest<T>(operation: () => Promise<T>): Promise<T> {
  const next = requestChain
    .catch(() => undefined)
    .then(operation);
  requestChain = next.catch(() => undefined);

  return next;
}

export const apiClient = {
  baseUrl: configuredBaseUrl.replace(/\/$/, ''),

  onSessionExpired(handler: (() => void) | null): void {
    sessionExpiredHandler = handler;
  },

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  },

  async csrf(): Promise<void> {
    let response: Response;

    try {
      response = await fetch(this.url('/sanctum/csrf-cookie'), {
        credentials: 'include',
      });
    } catch {
      throw networkError();
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status);
      }

      throw new ApiError('No se pudo preparar la sesión segura. Revise el servidor local e intente de nuevo.', response.status);
    }
  },

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      } catch {
        throw networkError();
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
        throw new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status);
      }

      if (response.status === 403) {
        throw new ApiError(PERMISSION_DENIED_MESSAGE, response.status);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('La sesión expiró. Actualice la pantalla e intente de nuevo.', response.status);
      }

      if (response.status === 422 && error?.errors) {
        const validationMessage = Object.values(error.errors).flat().filter(Boolean).slice(0, 3).join(' ');
        throw new ApiError(validationMessage || 'Revise los datos del formulario.', response.status, error.errors);
      }

      throw new ApiError(error?.message ?? `HTTP ${response.status}`, response.status);
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
    } catch {
      throw networkError();
    }

    if (!response.ok) {
      if (response.status === 401) {
        sessionExpiredHandler?.();
        throw new ApiError('Sesión vencida. Vuelva a iniciar sesión para continuar.', response.status);
      }

      if (response.status === 403) {
        throw new ApiError(PERMISSION_DENIED_MESSAGE, response.status);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('La sesión expiró. Actualice la pantalla e intente de nuevo.', response.status);
      }

      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(error?.message ?? `HTTP ${response.status}`, response.status);
    }

    return response.blob();
  },
};
