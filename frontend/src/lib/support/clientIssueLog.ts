type ClientIssueContext = {
  action?: string;
  module?: string;
  route?: string;
};

export type StoredClientIssue = {
  action?: string;
  module?: string;
  route: string;
  safe_message: string;
  technical_code: string;
  occurred_at: string;
};

type SupportSummaryContext = {
  current_route?: string;
  app_origin?: string;
  generated_at?: string;
};

const STORAGE_KEY = 'hospital_client_issue_log';
const MAX_ISSUES = 20;

export const PERMISSION_DENIED_MESSAGE =
  'Su usuario no tiene permiso para esta acción. Solicite a un supervisor que revise su rol; no repita la operación varias veces.';

export function safeClientMessage(value: string): string {
  return value
    .replace(/\b(https?:\/\/)(?:[^\s/@]+@)([^\s]+)/gi, '$1$2')
    .replace(/(?:password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD)\s*[:=]\s*\S+/gi, '[redacted]')
    .replace(/password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD/gi, '[redacted]')
    .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:id|key|token|secret|password)\b/gi, '[campo-interno]')
    .replace(/\bSQLSTATE\[[^\]]+\][^.;\n\r]*/gi, '[detalle-tecnico]')
    .replace(/\bstorage[\\/]+logs[\\/]+[^\s]+/gi, '[ruta-local]')
    .replace(/[A-Z]:\\[^\s]+/gi, '[ruta-local]')
    .replace(/\/(?:home|var|etc|srv|tmp|Users|xampp|laragon)\/[^\s]+/gi, '[ruta-local]')
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

export function buildClientIssueSupportSummary(issues: StoredClientIssue[], context: SupportSummaryContext = {}): string {
  const generatedAt = context.generated_at ?? new Date().toISOString();
  const lines = [
    'Resumen seguro para soporte',
    `Generado: ${safeClientMessage(generatedAt)}`,
    `Pantalla: ${safeClientMessage(context.current_route ?? 'no indicada')}`,
    `Dirección local: ${safeClientMessage(context.app_origin ?? 'no indicada')}`,
    `Incidentes guardados en este navegador: ${issues.length}`,
    '',
    'Últimos incidentes seguros:',
  ];

  if (issues.length === 0) {
    lines.push('- Sin incidentes guardados en este navegador.');
  } else {
    issues.slice(0, 3).forEach((issue, index) => {
      lines.push(
        [
          `${index + 1}. ${safeClientMessage(issue.module ?? 'sistema')} - ${safeClientMessage(issue.action ?? 'acción no indicada')}`,
          `   Pantalla: ${safeClientMessage(issue.route)}`,
          `   Mensaje: ${safeClientMessage(issue.safe_message)}`,
          `   Código técnico: ${safeClientMessage(issue.technical_code)}`,
          `   Fecha: ${safeClientMessage(issue.occurred_at)}`,
        ].join('\n'),
      );
    });
  }

  lines.push('', 'Acción segura: no repetir facturas ni cobros hasta que caja e historial confirmen el estado.');

  return lines.join('\n');
}

export function getClientIssues(): StoredClientIssue[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const issues = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredClientIssue[];

    return Array.isArray(issues) ? issues.slice(0, MAX_ISSUES) : [];
  } catch {
    return [];
  }
}
