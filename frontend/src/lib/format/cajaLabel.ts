/**
 * Etiqueta visible de una caja a partir del texto que arma el servidor.
 *
 * Algunos contratos entregan la caja como «Caja principal (principal)»,
 * «Sesion #14» o «Caja #14»: el código interno entre paréntesis y el número
 * de sesión no le dicen nada al personal. Aquí solo se cambia la
 * presentación; el dato del servidor no se modifica.
 */
const INTERNAL_ONLY_RE = /^(?:sesi[oó]n|caja|turno)\s*#\s*\d+$/i;
const TRAILING_CODE_RE = /\s*\([A-Za-z0-9_.-]+\)$/;

export function humanCajaLabel(label: string | null | undefined, fallback = 'Caja del turno'): string {
  const trimmed = label?.trim() ?? '';
  if (trimmed === '') return fallback;
  if (INTERNAL_ONLY_RE.test(trimmed)) return fallback;

  const withoutCode = trimmed.replace(TRAILING_CODE_RE, '').trim();
  return withoutCode === '' ? fallback : withoutCode;
}
