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

const SCREEN_LABELS: Array<[RegExp, string]> = [
  [/^\/?$/i, 'Inicio'],
  [/^\/dashboard\b/i, 'Inicio'],
  [/^\/billing\b/i, 'Nueva factura'],
  [/^\/cashbox\b/i, 'Caja'],
  [/^\/catalog\b/i, 'Catalogo'],
  [/^\/invoices\b/i, 'Historial'],
  [/^\/reports\b/i, 'Reportes'],
  [/^\/backups\b/i, 'Respaldos'],
  [/^\/settings\/fiscal\b/i, 'Datos fiscales'],
  [/^\/admin\/users\b/i, 'Usuarios'],
  [/^\/help\b/i, 'Ayuda'],
  [/^\/about\b/i, 'Estado del sistema'],
];

export const PERMISSION_DENIED_MESSAGE =
  'Su usuario no tiene permiso para esta accion. Solicite a un supervisor que revise su rol; no repita la operacion varias veces.';

export function safeClientMessage(value: string): string {
  return value
    .replace(/\b(https?:\/\/)(?:[^\s/@]+@)([^\s]+)/gi, '$1$2')
    .replace(/(?:password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD)\s*[:=]\s*\S+/gi, '[redacted]')
    .replace(/password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD/gi, '[redacted]')
    .replace(/(^|[^\w.-])\.env(?:\.[A-Za-z0-9_-]+)?\b/gi, '$1[archivo-protegido]')
    .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:id|key|token|secret|password)\b/gi, '[campo-interno]')
    .replace(/\bSQLSTATE\[[^\]]+\][^.;\n\r]*/gi, '[detalle-tecnico]')
    .replace(/\bstorage[\\/]+logs[\\/]+[^\s]+/gi, '[ruta-local]')
    .replace(/[A-Z]:\\[^\s]+/gi, '[ruta-local]')
    .replace(/\/(?:home|var|etc|srv|tmp|Users|xampp|laragon)\/[^\s]+/gi, '[ruta-local]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function safeOptionalContext(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const safeValue = safeClientMessage(value);

  return safeValue === '' ? undefined : safeValue;
}

function routePath(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const safeValue = safeClientMessage(value);

  try {
    return new URL(safeValue, window.location.origin).pathname;
  } catch {
    return safeValue.split(/[?#]/)[0] ?? '';
  }
}

function supportScreenLabel(value: string | undefined): string {
  const safeValue = safeClientMessage(value ?? '');

  if (SCREEN_LABELS.some(([, label]) => label.toLowerCase() === safeValue.toLowerCase())) {
    return safeValue;
  }

  const path = routePath(value);
  const match = SCREEN_LABELS.find(([pattern]) => pattern.test(path));

  return match?.[1] ?? 'Pantalla no indicada';
}

function supportModuleLabel(value: string | undefined): string | undefined {
  const safeValue = safeOptionalContext(value);

  if (!safeValue) {
    return undefined;
  }

  const normalized = safeValue.toLowerCase();

  if (['conexion local', 'facturacion', 'caja', 'respaldos', 'reportes', 'catalogo', 'ingreso'].includes(normalized)) {
    return safeValue;
  }

  if (normalized.includes('api') || normalized.includes('network')) return 'Conexion local';
  if (normalized.includes('billing') || normalized.includes('invoice')) return 'Facturacion';
  if (normalized.includes('cash')) return 'Caja';
  if (normalized.includes('backup')) return 'Respaldos';
  if (normalized.includes('report')) return 'Reportes';
  if (normalized.includes('catalog')) return 'Catalogo';
  if (normalized.includes('auth') || normalized.includes('login')) return 'Ingreso';

  return safeValue;
}

function supportActionLabel(value: string | undefined): string | undefined {
  const safeValue = safeOptionalContext(value);

  if (!safeValue) {
    return undefined;
  }

  const normalized = safeValue.toLowerCase();

  if (
    [
      'revision de conexion local',
      'registro de factura',
      'registro de pago',
      'consulta de historial',
      'operacion de caja',
      'operacion de respaldo',
      'consulta de reportes',
      'ingreso de usuario',
      'consulta de catalogo',
      'accion registrada',
    ].includes(normalized)
  ) {
    return safeValue;
  }

  if (normalized.includes('/api/health') || normalized.includes('/api/system/status')) return 'Revision de conexion local';
  if (normalized.includes('/api/invoices') && normalized.includes('post')) return 'Registro de factura';
  if (normalized.includes('/api/invoices')) return 'Consulta de historial';
  if (normalized.includes('/api/payments')) return 'Registro de pago';
  if (normalized.includes('/api/cash-sessions')) return 'Operacion de caja';
  if (normalized.includes('/api/backups')) return 'Operacion de respaldo';
  if (normalized.includes('/api/reports')) return 'Consulta de reportes';
  if (normalized.includes('/api/auth')) return 'Ingreso de usuario';
  if (normalized.includes('/api/services') || normalized.includes('/api/categories') || normalized.includes('/api/areas')) return 'Consulta de catalogo';

  return 'Accion registrada';
}

function supportReferenceLabel(value: string | undefined): string {
  const safeValue = safeClientMessage(value || 'CLIENT_ERROR');
  const normalized = safeValue.toLowerCase();

  if (['caja cerrada', 'respaldo con error', 'aviso de conexion', 'aviso del sistema', 'aviso seguro'].includes(normalized)) {
    return safeValue;
  }

  if (normalized.includes('cashsessionclosed')) return 'Caja cerrada';
  if (normalized.includes('backupfailed')) return 'Respaldo con error';
  if (normalized.includes('apierror')) return 'Aviso de conexion';
  if (normalized.includes('error')) return 'Aviso del sistema';

  return 'Aviso seguro';
}

function safeStoredIssue(issue: StoredClientIssue): StoredClientIssue {
  return {
    action: supportActionLabel(issue.action),
    module: supportModuleLabel(issue.module),
    route: supportScreenLabel(issue.route),
    safe_message: safeClientMessage(issue.safe_message),
    technical_code: supportReferenceLabel(issue.technical_code),
    occurred_at: safeClientMessage(issue.occurred_at),
  };
}

export function logClientIssue(error: unknown, context: ClientIssueContext = {}): void {
  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredClientIssue[];
    const issue = safeStoredIssue({
      action: context.action,
      module: context.module,
      route: context.route ?? window.location.pathname,
      safe_message: safeClientMessage(error instanceof Error ? error.message : 'Error de interfaz'),
      technical_code: error instanceof Error ? error.name : 'CLIENT_ERROR',
      occurred_at: new Date().toISOString(),
    });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([issue, ...existing].slice(0, MAX_ISSUES)));
  } catch {
    // Support logging must never block the cashier workflow.
  }
}

export function buildClientIssueSupportSummary(issues: StoredClientIssue[], context: SupportSummaryContext = {}): string {
  const generatedAt = context.generated_at ?? new Date().toISOString();
  const safeIssues = issues.map(safeStoredIssue);
  const lines = [
    'Resumen seguro para soporte',
    `Generado: ${safeClientMessage(generatedAt)}`,
    `Pantalla: ${supportScreenLabel(context.current_route)}`,
    `Direccion local: ${safeClientMessage(context.app_origin ?? 'no indicada')}`,
    `Incidentes guardados en este navegador: ${issues.length}`,
    '',
    'Ultimos incidentes seguros:',
  ];

  if (safeIssues.length === 0) {
    lines.push('- Sin incidentes guardados en este navegador.');
  } else {
    safeIssues.slice(0, 3).forEach((issue, index) => {
      lines.push(
        [
          `${index + 1}. ${safeClientMessage(issue.module ?? 'sistema')} - ${safeClientMessage(issue.action ?? 'accion no indicada')}`,
          `   Pantalla: ${safeClientMessage(issue.route)}`,
          `   Mensaje: ${safeClientMessage(issue.safe_message)}`,
          `   Referencia: ${safeClientMessage(issue.technical_code)}`,
          `   Fecha: ${safeClientMessage(issue.occurred_at)}`,
        ].join('\n'),
      );
    });
  }

  lines.push('', 'Accion segura: no repetir facturas ni cobros hasta que caja e historial confirmen el estado.');

  return lines.join('\n');
}

export function getClientIssues(): StoredClientIssue[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const issues = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredClientIssue[];

    return Array.isArray(issues) ? issues.slice(0, MAX_ISSUES).map(safeStoredIssue) : [];
  } catch {
    return [];
  }
}
