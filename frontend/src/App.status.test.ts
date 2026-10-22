import { describe, expect, it } from 'vitest';
import {
  clearShellStatusForUserChange,
  reduceShellStatus,
  type ShellStatus,
  visibleShellStatusMessage,
} from './App';

const printError: ShellStatus = {
  key: 'cobrar-receipt',
  level: 'error',
  message: 'No se pudo abrir el PDF institucional.',
  ownerUserId: 7,
};

describe('App: banda operativa del shell', () => {
  it('no convierte feedback informativo local en una banda persistente', () => {
    expect(reduceShellStatus(null, {
      key: 'cobrar-catalog',
      level: 'success',
      message: 'Agregado: Amilasa',
      toast: false,
    }, 7)).toBeNull();
  });

  it('mantiene visible un error local sin duplicarlo como toast', () => {
    expect(reduceShellStatus(null, {
      ...printError,
      toast: false,
    }, 7)).toEqual(printError);
  });

  it('no limpia un error por un evento de otra clave', () => {
    expect(reduceShellStatus(printError, {
      key: 'cobrar-catalog',
      level: 'success',
      message: 'Agregado: Amilasa',
      toast: false,
    }, 7)).toEqual(printError);
  });

  it('no usa claves ausentes como coincidencias ambiguas', () => {
    const unkeyedError: ShellStatus = {
      level: 'warning',
      message: 'Revise la operación pendiente.',
      ownerUserId: 7,
    };

    expect(reduceShellStatus(unkeyedError, {
      level: 'success',
      message: 'Operación completada.',
      toast: false,
    }, 7)).toEqual(unkeyedError);
  });

  it('limpia únicamente cuando una recuperación comparte la clave explícita', () => {
    expect(reduceShellStatus(printError, {
      key: 'cobrar-receipt',
      level: 'success',
      message: 'PDF institucional guardado.',
      toast: false,
    }, 7)).toBeNull();
  });

  it('no convierte un toast verdadero en banda global', () => {
    expect(reduceShellStatus(null, {
      key: 'reportes-export',
      level: 'success',
      message: 'Excel listo para descargar.',
      toast: true,
    }, 7)).toBeNull();
  });

  it('conserva la banda en rerenders del mismo usuario', () => {
    expect(clearShellStatusForUserChange(printError, 7, 7)).toEqual(printError);
  });

  it('descarta la banda al cerrar sesión o entrar con otro usuario', () => {
    expect(clearShellStatusForUserChange(printError, 7, null)).toBeNull();
    expect(clearShellStatusForUserChange(printError, 7, 8)).toBeNull();
  });

  it('oculta la banda durante el render de transición a otro usuario', () => {
    expect(visibleShellStatusMessage(printError, 7)).toBe(printError.message);
    expect(visibleShellStatusMessage(printError, 8)).toBe('');
    expect(visibleShellStatusMessage(printError, null)).toBe('');
  });
});
