import { describe, expect, it } from 'vitest';
import { parseCents, parseQuantityUnits } from '../../../lib/moneyCents';
import {
  collectCartIssues,
  computeSimpleEstimate,
  incrementQuantityFromString,
  parseTaxRateBasisPoints,
  resolveCartAvailability,
  type CartAvailabilityOptions,
} from './posMath';
import type { CartItem } from './cartTypes';

function buildCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    service: {
      id: 1,
      name: 'Consulta general',
      price: '150.00',
      taxable: true,
      active: true,
      visible_in_billing: true,
      is_billable: true,
      category_id: 1,
      area_id: null,
      scan_code: null,
      barcode: null,
      qr_code: null,
      slug: 'consulta-general',
      special_rule_code: null,
    },
    quantity: '1.00',
    dialysisPrescription: false,
    ...overrides,
  };
}

function availabilityOptions(overrides: Partial<CartAvailabilityOptions> = {}): CartAvailabilityOptions {
  return {
    taxRate: '15.00',
    settingsState: 'ready',
    canMarkDialysisPrescription: true,
    ...overrides,
  };
}

describe('posMath · cantidades canónicas', () => {
  it('parses quantity input into integer hundredths and rejects invalid input', () => {
    expect(parseQuantityUnits('1')).toBe(100);
    expect(parseQuantityUnits('1.5')).toBe(150);
    expect(parseQuantityUnits('1.55')).toBe(155);
    expect(parseQuantityUnits('not-a-number')).toBe(null);
    expect(parseQuantityUnits('0')).toBe(null);
  });

  it('increments a quantity by one whole unit without inventing zero', () => {
    expect(incrementQuantityFromString('1.00')).toBe('2.00');
    expect(incrementQuantityFromString('1.50')).toBe('2.50');
    expect(incrementQuantityFromString('not-a-number')).toBe('not-a-number');
  });
});

describe('posMath · tasa de impuesto', () => {
  it('parses valid rates and reports invalid/missing as null', () => {
    expect(parseTaxRateBasisPoints(undefined)).toBe(null);
    expect(parseTaxRateBasisPoints(null)).toBe(null);
    expect(parseTaxRateBasisPoints('')).toBe(null);
    expect(parseTaxRateBasisPoints('not-a-number')).toBe(null);
    expect(parseTaxRateBasisPoints('0')).toBe(0);
    expect(parseTaxRateBasisPoints('15')).toBe(1500);
    expect(parseTaxRateBasisPoints('15.00')).toBe(1500);
  });
});

describe('posMath · estimado provisional en decimales de intercambio', () => {
  it('computes the cart estimate for a normal service', () => {
    const estimate = computeSimpleEstimate([buildCartItem({ quantity: '2.00' })], '15.00');

    expect(estimate.subtotal).toBe('300.00');
    expect(estimate.tax).toBe('45.00');
    expect(estimate.total).toBe('345.00');
    expect(parseCents(estimate.total)).toBe(34500);
  });

  it('never returns localized text with thousands separators', () => {
    const estimate = computeSimpleEstimate([
      buildCartItem({ service: { ...buildCartItem().service, price: '1029.25', taxable: false } }),
    ], '0');

    expect(estimate.total).toBe('1029.25');
    expect(parseCents(estimate.total)).toBe(102925);
  });

  it('rounds fractional line subtotals half up like the backend', () => {
    const estimate = computeSimpleEstimate([
      buildCartItem({
        quantity: '1.50',
        service: { ...buildCartItem().service, price: '0.01', taxable: false },
      }),
    ], '15.00');

    expect(estimate.subtotal).toBe('0.02');
    expect(estimate.tax).toBe('0.00');
    expect(estimate.total).toBe('0.02');
  });

  it('rounds tax on the aggregated taxable subtotal like the backend', () => {
    const estimate = computeSimpleEstimate([
      buildCartItem({ service: { ...buildCartItem().service, id: 1, price: '0.03', taxable: true } }),
      buildCartItem({ service: { ...buildCartItem().service, id: 2, price: '0.03', taxable: true } }),
    ], '15.00');

    expect(estimate.subtotal).toBe('0.06');
    expect(estimate.tax).toBe('0.01');
    expect(estimate.total).toBe('0.07');
  });

  it('zeros the tax line for non-taxable services', () => {
    const estimate = computeSimpleEstimate([
      buildCartItem({ quantity: '1.00', service: { ...buildCartItem().service, taxable: false } }),
    ], '15.00');

    expect(estimate.subtotal).toBe('150.00');
    expect(estimate.tax).toBe('0.00');
    expect(estimate.total).toBe('150.00');
  });

  it('applies the erythropoietin rule and reports zero total when prescribed', () => {
    const estimate = computeSimpleEstimate(
      [
        buildCartItem({
          quantity: '1.00',
          dialysisPrescription: true,
          service: {
            ...buildCartItem().service,
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          },
        }),
      ],
      '15.00',
    );

    expect(estimate.subtotal).toBe('0.00');
    expect(estimate.tax).toBe('0.00');
    expect(estimate.total).toBe('0.00');
  });

  it('applies an invoice-level dialysis prescription to every erythropoietin line', () => {
    const erythropoietinService = {
      ...buildCartItem().service,
      price: '25.00',
      taxable: false,
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    };
    const estimate = computeSimpleEstimate([
      buildCartItem({
        dialysisPrescription: true,
        service: { ...erythropoietinService, id: 10 },
      }),
      buildCartItem({
        dialysisPrescription: false,
        service: { ...erythropoietinService, id: 11 },
      }),
    ]);

    expect(estimate.subtotal).toBe('0.00');
    expect(estimate.total).toBe('0.00');
  });

  it('uses the catalog price and taxability for erythropoietin without a prescription', () => {
    const estimate = computeSimpleEstimate(
      [
        buildCartItem({
          quantity: '1.00',
          dialysisPrescription: false,
          service: {
            ...buildCartItem().service,
            price: '25.00',
            taxable: true,
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          },
        }),
      ],
      '15.00',
    );

    expect(estimate.subtotal).toBe('25.00');
    expect(estimate.tax).toBe('3.75');
    expect(estimate.total).toBe('28.75');
  });
});

describe('posMath · disponibilidad del total (6 estados)', () => {
  it('estimated: cero legítimo con precio 0.00 no es "no disponible"', () => {
    expect(resolveCartAvailability(
      [buildCartItem({ service: { ...buildCartItem().service, price: '0.00', taxable: false } })],
      availabilityOptions(),
    )).toEqual({ status: 'estimated' });
  });

  it('calculating: aún no se conoce la tasa de impuesto', () => {
    expect(resolveCartAvailability([buildCartItem()], availabilityOptions({ settingsState: 'loading' })))
      .toMatchObject({ status: 'calculating' });
  });

  it('disconnected: no se pudo consultar la configuración operativa', () => {
    expect(resolveCartAvailability([buildCartItem()], availabilityOptions({ settingsState: 'error' })))
      .toMatchObject({ status: 'disconnected' });
  });

  it('disconnected: la API caída con carrito vacío no se presenta como cero legítimo', () => {
    const availability = resolveCartAvailability([], availabilityOptions({ serverUnreachable: true }));

    expect(availability).toMatchObject({ status: 'disconnected' });
    if (availability.status === 'disconnected') {
      expect(availability.message).toMatch(/sin conexión con el servidor local/i);
    }
    // Ni siquiera con un carrito vacío el POS puede afirmar un total cero.
    expect(availability.status).not.toBe('estimated');
  });

  it('invalid: precio mal formado se expone como incidencia, no como cero', () => {
    const availability = resolveCartAvailability(
      [buildCartItem({ service: { ...buildCartItem().service, price: 'monto-danado' } })],
      availabilityOptions(),
    );

    expect(availability.status).toBe('invalid');
    if (availability.status === 'invalid') {
      expect(availability.issues[0]).toMatchObject({ kind: 'invalid_price' });
    }
    expect(collectCartIssues([
      buildCartItem({ service: { ...buildCartItem().service, price: 'monto-danado' } }),
    ])).toHaveLength(1);
  });

  it('invalid: cantidad mal formada se expone como incidencia', () => {
    const availability = resolveCartAvailability(
      [buildCartItem({ quantity: '0' })],
      availabilityOptions(),
    );

    expect(availability.status).toBe('invalid');
  });

  it('unavailable: falta el impuesto en una cuenta con líneas gravadas', () => {
    const availability = resolveCartAvailability([buildCartItem()], availabilityOptions({ taxRate: undefined }));

    expect(availability).toMatchObject({ status: 'unavailable', reason: 'tax_rate_missing' });
  });

  it('unavailable: tasa de impuesto inválida', () => {
    const availability = resolveCartAvailability([buildCartItem()], availabilityOptions({ taxRate: 'no-es-tasa' }));

    expect(availability).toMatchObject({ status: 'unavailable', reason: 'tax_rate_invalid' });
  });

  it('estimated: sin líneas gravadas no se necesita la tasa de impuesto', () => {
    expect(resolveCartAvailability(
      [buildCartItem({ service: { ...buildCartItem().service, taxable: false } })],
      availabilityOptions({ taxRate: undefined }),
    )).toEqual({ status: 'estimated' });
  });
});
