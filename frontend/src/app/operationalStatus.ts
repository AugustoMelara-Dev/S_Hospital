export type OperationalStatusLevel = 'error' | 'info' | 'success' | 'warning';

export type OperationalStatusEvent = {
  key?: string;
  level: OperationalStatusLevel;
  message: string;
  toast?: boolean;
};

export type OperationalStatusInput = OperationalStatusEvent;
export type OperationalStatusReporter = (status: OperationalStatusInput) => void;

const OPERATIONAL_STATUS_LEVELS = new Set<OperationalStatusLevel>([
  'error',
  'info',
  'success',
  'warning',
]);

export function normalizeOperationalStatus(status: OperationalStatusInput): OperationalStatusEvent & { toast: boolean } {
  if (
    typeof status !== 'object'
    || status === null
    || typeof status.message !== 'string'
    || status.message.trim() === ''
    || !OPERATIONAL_STATUS_LEVELS.has(status.level)
  ) {
    throw new Error('Se requiere un estado operativo con mensaje y severidad explícita.');
  }

  return {
    ...status,
    message: humanOperationalMessage(status.message),
    toast: status.toast ?? true,
  };
}

function humanOperationalMessage(message: string): string {
  if (/\b(timeout|timed out)\b|excedi[oó]\s+\d+(?:\.\d+)?\s*(?:ms|s)\b|sin respuesta del servidor/i.test(message)) {
    return 'La respuesta está tardando más de lo esperado. Intente nuevamente.';
  }

  if (/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/?|\/api\/|SQLSTATE|exception|stack|trace|[A-Z]:\\|\/var\/www\//i.test(message)) {
    return 'No se pudo completar la acción. Intente nuevamente.';
  }

  return message;
}
