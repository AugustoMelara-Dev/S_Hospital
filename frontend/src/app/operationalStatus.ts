import { isErrorMessage } from '@/lib/api/user-error';

export type OperationalStatusLevel = 'error' | 'info' | 'success' | 'warning';

export type OperationalStatusEvent = {
  key?: string;
  level: OperationalStatusLevel;
  message: string;
  toast?: boolean;
};

export type OperationalStatusInput = string | OperationalStatusEvent;
export type OperationalStatusReporter = (status: OperationalStatusInput) => void;

const progressPrefixes = [
  'Cargando', 'Consultando', 'Preparando', 'Validando', 'Actualizando',
  'Guardando', 'Abriendo', 'Cerrando', 'Subiendo', 'Creando',
  'Restableciendo', 'Cambiando', 'Revisando',
];

export function normalizeOperationalStatus(status: OperationalStatusInput): OperationalStatusEvent & { toast: boolean } {
  if (typeof status !== 'string') {
    return { ...status, toast: status.toast ?? true };
  }

  return {
    key: `legacy:${status}`,
    level: isErrorMessage(status) ? 'error' : 'info',
    message: status,
    toast: !progressPrefixes.some((prefix) => status.startsWith(prefix)),
  };
}
