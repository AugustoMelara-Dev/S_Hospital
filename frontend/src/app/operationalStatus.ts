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

  return { ...status, toast: status.toast ?? true };
}
