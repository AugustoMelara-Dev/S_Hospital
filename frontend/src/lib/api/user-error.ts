/**
 * Heuristics to decide whether a status string is an error so that we
 * can route it to notify.error instead of notify.success.
 *
 * Centralised here so the App-level onStatus wrapper does not need to
 * duplicate the magic words.
 */
const ERROR_PREFIXES = [
  'No se pudo',
  'No se puede',
  'No pude',
  'Error',
  'Fallo',
  'Falló',
  'Bloqueado',
  'Bloqueada',
  'Denegado',
  'Denegada',
  'Rechazado',
  'Rechazada',
  'Invalido',
  'Inválido',
  'Invalida',
  'Inválida',
  'Ingrese',
  'Debe',
  'Falta',
  'Vencida',
  'Vencido',
];

const ERROR_WORDS = [
  'bloqueado temporalmente',
  'contraseña incorrecta',
  'credenciales inv',
  'no autorizado',
  'permiso denegado',
  'sesi\u00f3n vencida',
];

export function isErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (ERROR_PREFIXES.some((prefix) => lower.startsWith(prefix.toLowerCase()))) {
    return true;
  }
  if (ERROR_WORDS.some((word) => lower.includes(word))) {
    return true;
  }
  return false;
}
