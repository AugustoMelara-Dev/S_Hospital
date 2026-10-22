import { describe, expect, it } from 'vitest';
import type { Service, TaxRate } from '@/lib/api';
import {
  catalogTaxReviewRequired,
  resolveServiceTaxRateId,
  serviceTaxLabel,
} from './catalogTax';

const isv15: TaxRate = { id: 1, name: 'ISV 15 %', percentage: '15.00', active: true, is_default: true };
const isv18: TaxRate = { id: 2, name: 'ISV 18 %', percentage: '18.00', active: true, is_default: false };
const exento: TaxRate = { id: 3, name: 'Exento', percentage: '0.00', active: true, is_default: false };

function service(overrides: Partial<Service> & { tax_rate_id?: number | null } = {}): Service {
  return {
    id: 1,
    category_id: 1,
    name: 'Glucosa',
    slug: 'glucosa',
    price: '15.00',
    taxable: true,
    active: true,
    special_rule_code: null,
    ...overrides,
  } as Service;
}

describe('catalogTax', () => {
  it('lee la tasa explícita del servicio, incluido null como exento', () => {
    expect(resolveServiceTaxRateId(service({ tax_rate_id: 2 }), [isv15, isv18])).toBe(2);
    expect(resolveServiceTaxRateId(service({ tax_rate_id: null }), [isv15])).toBeNull();
  });

  it('sin tax_rate_id en la API usa la lectura heredada de taxable y la predeterminada', () => {
    expect(resolveServiceTaxRateId(service({ taxable: true }), [isv15, exento])).toBe(1);
    expect(resolveServiceTaxRateId(service({ taxable: false }), [isv15, exento])).toBeNull();
  });

  it('nombra la tasa sin inventar una cuando el id no existe', () => {
    expect(serviceTaxLabel(service({ tax_rate_id: 2 }), [isv15, isv18])).toBe('ISV 18 %');
    expect(serviceTaxLabel(service({ tax_rate_id: null }), [isv15])).toBe('Exento');
    expect(serviceTaxLabel(service({ tax_rate_id: 999 }), [isv15])).toBe('Tasa no disponible');
  });

  it('respeta el indicador del servidor cuando existe', () => {
    expect(catalogTaxReviewRequired({ flag: true, taxRates: [isv15], services: [service({ tax_rate_id: 1 })] })).toBe(true);
    expect(catalogTaxReviewRequired({ flag: false, taxRates: [isv15], services: [service({ tax_rate_id: null })] })).toBe(false);
  });

  it('avisa cuando hay tasas gravables pero el catálogo visible no usa ninguna', () => {
    expect(catalogTaxReviewRequired({
      flag: null,
      taxRates: [isv15, exento],
      services: [service({ tax_rate_id: null }), service({ id: 2, tax_rate_id: 3 })],
    })).toBe(true);
  });

  it('no avisa si algún concepto visible ya está gravado', () => {
    expect(catalogTaxReviewRequired({
      flag: null,
      taxRates: [isv15, exento],
      services: [service({ tax_rate_id: 1 })],
    })).toBe(false);
  });

  it('avisa si sólo existen tasas de 0 % y no afirma nada sin tasas', () => {
    expect(catalogTaxReviewRequired({ flag: null, taxRates: [exento], services: [] })).toBe(true);
    expect(catalogTaxReviewRequired({ flag: null, taxRates: [], services: [service()] })).toBe(false);
  });
});
