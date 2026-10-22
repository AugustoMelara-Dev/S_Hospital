import { describe, expect, it } from 'vitest';
import {
  formatTaxPercentage,
  normalizeTaxPercentage,
  taxRateIsExempt,
  taxRateReasonError,
} from './taxRatesFormat';

describe('taxRatesFormat', () => {
  it('normaliza el porcentaje escrito al decimal de dos cifras del contrato', () => {
    expect(normalizeTaxPercentage('15')).toBe('15.00');
    expect(normalizeTaxPercentage(' 15,5 ')).toBe('15.50');
    expect(normalizeTaxPercentage('0')).toBe('0.00');
    expect(normalizeTaxPercentage('99.99')).toBe('99.99');
  });

  it('rechaza porcentajes fuera de rango o con más decimales', () => {
    expect(normalizeTaxPercentage('100')).toBeNull();
    expect(normalizeTaxPercentage('15.999')).toBeNull();
    expect(normalizeTaxPercentage('-5')).toBeNull();
    expect(normalizeTaxPercentage('abc')).toBeNull();
    expect(normalizeTaxPercentage('')).toBeNull();
  });

  it('presenta el porcentaje sin ceros decorativos ni falsas tasas', () => {
    expect(formatTaxPercentage('15.00')).toBe('15 %');
    expect(formatTaxPercentage('7.50')).toBe('7.5 %');
    expect(formatTaxPercentage('0.00')).toBe('0 %');
    expect(formatTaxPercentage('corrupto')).toBe('—');
  });

  it('trata 0 % como exento', () => {
    expect(taxRateIsExempt({ percentage: '0.00' })).toBe(true);
    expect(taxRateIsExempt({ percentage: '15.00' })).toBe(false);
  });

  it('exige un motivo de entre 5 y 255 caracteres', () => {
    expect(taxRateReasonError('abc')).toMatch(/al menos 5/i);
    expect(taxRateReasonError('a'.repeat(256))).toMatch(/255/);
    expect(taxRateReasonError('Cambio autorizado')).toBeNull();
  });
});
