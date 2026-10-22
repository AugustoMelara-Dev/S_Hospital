import { describe, expect, it } from 'vitest';
import { normalizeSearchText } from './normalizeText';

describe('normalizeSearchText', () => {
  it('plega acentos y pasa a minúsculas', () => {
    expect(normalizeSearchText('HÉMATOLOGÍA')).toBe('hematologia');
    expect(normalizeSearchText('González')).toBe('gonzalez');
    expect(normalizeSearchText('Eritropoyetina Diálisis')).toBe('eritropoyetina dialisis');
  });

  it('encuentra coincidencias con y sin acentos en ambos sentidos', () => {
    const catalogNames = ['Hemograma completo', 'Química sanguínea', 'Radiografía de tórax'];

    expect(catalogNames.filter((name) => normalizeSearchText(name).includes(normalizeSearchText('quimica')))).toEqual(['Química sanguínea']);
    expect(catalogNames.filter((name) => normalizeSearchText(name).includes(normalizeSearchText('química')))).toEqual(['Química sanguínea']);
    expect(catalogNames.filter((name) => normalizeSearchText(name).includes(normalizeSearchText('RADIOGRAFIA')))).toEqual(['Radiografía de tórax']);
  });

  it('recorta extremos para que un espacio accidental no rompa la búsqueda', () => {
    expect(normalizeSearchText('  María José  ')).toBe('maria jose');
    expect(normalizeSearchText('  ')).toBe('');
  });

  it('conserva números, espacios internos y signos útiles para referencias', () => {
    expect(normalizeSearchText('REC-A-00000014')).toBe('rec-a-00000014');
    expect(normalizeSearchText('Pago #12 / Caja 3')).toBe('pago #12 / caja 3');
  });

  it('no depende de mayúsculas sostenidas del sistema operativo', () => {
    expect(normalizeSearchText('ÑANDÚ')).toBe('nandu');
    expect(normalizeSearchText('ÜBER')).toBe('uber');
  });
});
