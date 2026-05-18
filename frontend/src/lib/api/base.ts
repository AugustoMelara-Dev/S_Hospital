let sessionExpiredHandler: (() => void) | null = null;
let requestChain: Promise<unknown> = Promise.resolve();

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 419);
}

export function userSafeErrorMessage(error: unknown, fallback: string): string {
  if (isSessionExpiredError(error)) {
    return 'Sesion vencida. Vuelva a iniciar sesion para continuar.';
  }

  if (error instanceof ApiError && error.status === 403) {
    return 'No tiene permiso para esta accion.';
  }

  if (error instanceof ApiError && error.status === 422) {
    return error.message;
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
    const response = await fetch(this.url('/sanctum/csrf-cookie'), {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('Sesion vencida. Vuelva a iniciar sesion para continuar.', response.status);
      }

      throw new ApiError('No se pudo preparar la sesion segura. Revise el servidor local e intente de nuevo.', response.status);
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

      return fetch(this.url(path), {
        ...options,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
          ...options.headers,
        },
      });
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
        throw new ApiError('Sesion vencida. Vuelva a iniciar sesion para continuar.', response.status);
      }

      if (response.status === 403) {
        throw new ApiError('No tiene permiso para esta accion.', response.status);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('La sesion expiro. Actualice la pantalla e intente de nuevo.', response.status);
      }

      if (response.status === 422 && error?.errors) {
        const validationMessage = Object.values(error.errors).flat().filter(Boolean).slice(0, 3).join(' ');
        throw new ApiError(validationMessage || 'Revise los datos del formulario.', response.status);
      }

      throw new ApiError(error?.message ?? `HTTP ${response.status}`, response.status);
    }

    return (await response.json()) as T;
  },

  async download(path: string): Promise<Blob> {
    const response = await fetch(this.url(path), {
      credentials: 'include',
      headers: {
        Accept: 'application/json, application/octet-stream, text/csv',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        sessionExpiredHandler?.();
        throw new ApiError('Sesion vencida. Vuelva a iniciar sesion para continuar.', response.status);
      }

      if (response.status === 403) {
        throw new ApiError('No tiene permiso para esta accion.', response.status);
      }

      if (response.status === 419) {
        sessionExpiredHandler?.();
        throw new ApiError('La sesion expiro. Actualice la pantalla e intente de nuevo.', response.status);
      }

      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(error?.message ?? `HTTP ${response.status}`, response.status);
    }

    return response.blob();
  },
};
