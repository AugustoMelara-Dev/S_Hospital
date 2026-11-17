/**
 * Fetch wrapper for the S_Hospital API (SPEC §2).
 *
 * - Cookies: `credentials: 'include'` (httpOnly `shs_session`).
 * - CSRF: every non-GET sends `X-Requested-With: shospital`.
 * - Errors: the envelope `{error:{code,message,fields}}` becomes an `ApiError`.
 * - 401 → global unauthorized handler (logout → /login).
 * - 403 `password_change_required` → /cambiar-clave.
 * - Idempotency: `idempotent: true` (fresh key) or `idempotencyKey: key`
 *   (reuse the same key when retrying the same operation).
 */

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldErrors;

  constructor(status: number, code: string, message: string, fields: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Human message for any thrown value (for toasts / inline errors). */
export function errorMessage(e: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (isApiError(e)) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

type Handlers = {
  onUnauthorized: () => void;
  onPasswordChangeRequired: () => void;
};

function goTo(path: string): void {
  if (typeof window !== 'undefined' && window.location.pathname !== path) {
    window.location.assign(path);
  }
}

const handlers: Handlers = {
  onUnauthorized: () => goTo('/login'),
  onPasswordChangeRequired: () => goTo('/cambiar-clave'),
};

/** AuthProvider registers router-aware handlers here. */
export function setApiHandlers(next: Partial<Handlers>): void {
  Object.assign(handlers, next);
}

/**
 * UUID v4 using getRandomValues. `crypto.randomUUID` is NOT available on
 * plain-http LAN origins (insecure context), getRandomValues is.
 */
export function newIdempotencyKey(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  /** JSON-serialised unless it is FormData. */
  body?: unknown;
  /** Generate a fresh Idempotency-Key for this call. */
  idempotent?: boolean;
  /** Explicit Idempotency-Key (keep it stable across retries). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Do not run the global 401 handler (used by GET /auth/me and login). */
  skipAuthRedirect?: boolean;
  headers?: Record<string, string>;
};

export const API_BASE = '/api';

export function buildUrl(path: string, query?: Query): string {
  const base = path.startsWith('/api') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function buildInit(opts: RequestOptions, accept: string): RequestInit {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: accept, ...opts.headers };
  if (method !== 'GET') headers['X-Requested-With'] = 'shospital';
  const key = opts.idempotencyKey ?? (opts.idempotent ? newIdempotencyKey() : undefined);
  if (key) headers['Idempotency-Key'] = key;

  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const init: RequestInit = { method, headers, credentials: 'include' };
  if (body !== undefined) init.body = body;
  if (opts.signal) init.signal = opts.signal;
  return init;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'La operación no es válida.',
  401: 'Su sesión terminó. Inicie sesión de nuevo.',
  403: 'No tiene permiso para esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con el estado actual.',
  422: 'Revise los datos ingresados.',
  423: 'Demasiados intentos. Espere 15 minutos.',
  428: 'Falta la clave de idempotencia.',
  429: 'Demasiadas solicitudes. Intente de nuevo en un momento.',
};

async function toApiError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = FALLBACK_MESSAGES[res.status] ?? 'No se pudo completar la solicitud.';
  let fields: FieldErrors = {};
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'error' in data) {
      const err = (data as { error: { code?: string; message?: string; fields?: FieldErrors } }).error;
      if (err.code) code = err.code;
      if (err.message) message = err.message;
      if (err.fields) fields = err.fields;
    }
  } catch {
    /* non-JSON body: keep fallback */
  }
  return new ApiError(res.status, code, message, fields);
}

function handleGlobal(err: ApiError, opts: RequestOptions): void {
  if (err.status === 401 && !opts.skipAuthRedirect) handlers.onUnauthorized();
  if (err.status === 403 && err.code === 'password_change_required') handlers.onPasswordChangeRequired();
}

async function send(path: string, opts: RequestOptions, accept: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), buildInit(opts, accept));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network_error', 'No hay conexión con el servidor. Verifique la red local.');
  }
  if (!res.ok) {
    const err = await toApiError(res);
    handleGlobal(err, opts);
    throw err;
  }
  return res;
}

/** JSON request. Returns `null` for 204 / empty bodies. */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts, 'application/json');
  if (res.status === 204) return null as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts: Omit<RequestOptions, 'method' | 'query'> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE', body }),
};

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star?.[1]) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain?.[1] ?? fallback;
}

export type DownloadOptions = RequestOptions & {
  /** 'open' shows PDFs in a new tab; 'save' always downloads. Default: open for PDF. */
  mode?: 'open' | 'save';
  filename?: string;
};

/**
 * Downloads a binary (PDF/xlsx/csv/backup). PDFs open in a new tab; other
 * types are saved. The tab is opened synchronously (before the await) so
 * popup blockers accept it; call this directly from a click handler.
 */
export async function downloadFile(path: string, opts: DownloadOptions = {}): Promise<void> {
  const wantsOpen = opts.mode !== 'save';
  const pending = wantsOpen && typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const res = await send(path, opts, '*/*');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const isPdf = blob.type.includes('pdf') || (opts.filename ?? '').toLowerCase().endsWith('.pdf');
    if (wantsOpen && isPdf && pending) {
      pending.location.href = url;
    } else {
      pending?.close();
      const a = document.createElement('a');
      a.href = url;
      a.download = opts.filename ?? filenameFrom(res, 'documento');
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    pending?.close();
    throw e;
  }
}
