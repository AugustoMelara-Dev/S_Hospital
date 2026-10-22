import { describe, expect, it } from 'vitest';
import { humanCajaLabel } from './cajaLabel';

describe('humanCajaLabel', () => {
  it('muestra solo el nombre de la caja, sin su código interno', () => {
    expect(humanCajaLabel('Caja principal (principal)')).toBe('Caja principal');
    expect(humanCajaLabel('Caja Principal (CAJA-01)')).toBe('Caja Principal');
    expect(humanCajaLabel('Caja Emergencia')).toBe('Caja Emergencia');
  });

  it('nunca muestra el número interno de la sesión', () => {
    expect(humanCajaLabel('Sesion #14')).toBe('Caja del turno');
    expect(humanCajaLabel('Sesión #14')).toBe('Caja del turno');
    expect(humanCajaLabel('Caja #7')).toBe('Caja del turno');
  });

  it('usa el texto de respaldo cuando no hay etiqueta', () => {
    expect(humanCajaLabel(null)).toBe('Caja del turno');
    expect(humanCajaLabel('   ', 'No registrada')).toBe('No registrada');
  });
});
