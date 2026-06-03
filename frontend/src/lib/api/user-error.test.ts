import { describe, expect, it } from 'vitest';
import { isErrorMessage } from './user-error';

describe('isErrorMessage', () => {
  it('detects common Spanish error prefixes', () => {
    expect(isErrorMessage('No se pudo guardar el servicio.')).toBe(true);
    expect(isErrorMessage('No se puede anular una factura.')).toBe(true);
    expect(isErrorMessage('Error al conectar con el servidor.')).toBe(true);
    expect(isErrorMessage('Fallo al crear el respaldo.')).toBe(true);
    expect(isErrorMessage('Bloqueado temporalmente.')).toBe(true);
    expect(isErrorMessage('Permiso denegado.')).toBe(true);
    expect(isErrorMessage('Inválido: el nombre es requerido.')).toBe(true);
    expect(isErrorMessage('Vencida la sesión.')).toBe(true);
  });

  it('detects error substrings regardless of case', () => {
    expect(isErrorMessage('ERROR grave.')).toBe(true);
    expect(isErrorMessage('  No Se Pudo  ')).toBe(true);
  });

  it('returns false for success / info messages', () => {
    expect(isErrorMessage('Factura emitida correctamente.')).toBe(false);
    expect(isErrorMessage('Cargando servicios...')).toBe(false);
    expect(isErrorMessage('Caja abierta.')).toBe(false);
    expect(isErrorMessage('Listo para iniciar sesión local.')).toBe(false);
    expect(isErrorMessage('Cerrando caja...')).toBe(false);
  });

  it('returns false for empty / whitespace strings', () => {
    expect(isErrorMessage('')).toBe(false);
    expect(isErrorMessage('   ')).toBe(false);
  });

  it('does not flag innocuous words that contain "error" as a substring', () => {
    // "errores" alone (e.g. "0 errores") should NOT be classified as
    // a user-facing error; it is a count.
    expect(isErrorMessage('0 errores')).toBe(false);
    expect(isErrorMessage('Sesi\u00f3n OK.')).toBe(false);
  });
});
