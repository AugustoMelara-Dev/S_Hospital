type ClientIssueContext = {
  action?: string;
  module?: string;
  route?: string;
};

type StoredClientIssue = {
  action?: string;
  module?: string;
  route: string;
  safe_message: string;
  technical_code: string;
  occurred_at: string;
};

const STORAGE_KEY = 'hospital_client_issue_log';
const MAX_ISSUES = 20;

export const PERMISSION_DENIED_MESSAGE =
  'Su usuario no tiene permiso para esta accion. Solicite a un supervisor que revise su rol; no repita la operacion varias veces.';

export function safeClientMessage(value: string): string {
  return value
    .replace(/password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function logClientIssue(error: unknown, context: ClientIssueContext = {}): void {
  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredClientIssue[];
    const issue: StoredClientIssue = {
      action: context.action,
      module: context.module,
      route: context.route ?? window.location.pathname,
      safe_message: safeClientMessage(error instanceof Error ? error.message : 'Error de interfaz'),
      technical_code: error instanceof Error ? error.name : 'CLIENT_ERROR',
      occurred_at: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([issue, ...existing].slice(0, MAX_ISSUES)));
  } catch {
    // Support logging must never block the cashier workflow.
  }
}
