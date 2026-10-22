import { describe, expect, it } from 'vitest';
import type { Service } from '@/lib/api';
import {
  buildCobrarPayload,
  cartSubtotalCents,
  conditionActive,
  hasEligibleMedication,
  lineIsFree,
  lineTotalCents,
  toggleCondition,
} from './domain';
import type { CobrarLine } from './types';

const EPO_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

function service(overrides: Partial<Service> & Pick<Service, 'id' | 'name' | 'price'>): Service {
  return {
    category_id: 1,
    slug: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    taxable: false,
    active: true,
    special_rule_code: null,
    ...overrides,
  };
}

function line(overrides: Partial<CobrarLine> & Pick<CobrarLine, 'service'>): CobrarLine {
  return { quantity: '1', dialysisPrescription: false, ...overrides };
}

const epo = service({ id: 1, name: 'Eritropoyetina', price: '25.00', special_rule_code: EPO_RULE });
const dialysisService = service({ id: 2, name: 'Diálisis', price: '100.00' });
const products = Array.from({ length: 10 }, (_, index) =>
  service({ id: 100 + index, name: `Producto ${index + 1}`, price: '100.00' }),
);

describe('regla de gratuidad exclusiva del medicamento elegible', () => {
  it('con condición: EPO queda en 0 y los 10 productos mantienen L 100; total L 1,000', () => {
    const lines: CobrarLine[] = [
      line({ service: epo, dialysisPrescription: true }),
      ...products.map((product) => line({ service: product })),
    ];

    expect(lineIsFree(lines[0]!)).toBe(true);
    expect(lineTotalCents(lines[0]!)).toBe(0);
    for (const productLine of lines.slice(1)) {
      expect(lineIsFree(productLine)).toBe(false);
      expect(lineTotalCents(productLine)).toBe(10000);
    }

    expect(cartSubtotalCents(lines)).toBe(100000);
    expect(buildCobrarPayload({ lines, patientName: 'Ana', canMarkDialysisPrescription: true }).dialysis_prescription).toBe(true);
  });

  it('sin condición: todo conserva precio; total L 1,025', () => {
    const lines: CobrarLine[] = [
      line({ service: epo }),
      ...products.map((product) => line({ service: product })),
    ];

    expect(conditionActive(lines)).toBe(false);
    expect(lineTotalCents(lines[0]!)).toBe(2500);
    expect(cartSubtotalCents(lines)).toBe(102500);

    const payload = buildCobrarPayload({ lines, patientName: 'Ana', canMarkDialysisPrescription: true });
    expect(payload.dialysis_prescription).toBeUndefined();
  });

  it('condición activa sin elegible: ningún producto se vuelve gratuito', () => {
    const lines: CobrarLine[] = [line({ service: dialysisService }), ...products.map((product) => line({ service: product }))];
    const toggled = toggleCondition(lines, true);

    expect(conditionActive(toggled)).toBe(false);
    expect(toggled.every((item) => !lineIsFree(item))).toBe(true);
    expect(cartSubtotalCents(toggled)).toBe(110000);
    expect(
      buildCobrarPayload({ lines: toggled, patientName: 'Ana', canMarkDialysisPrescription: true })
        .dialysis_prescription,
    ).toBeUndefined();
  });

  it('no extiende el beneficio a otro medicamento con nombre parecido', () => {
    const lookalike = service({ id: 9, name: 'Eritropoyetina similar', price: '25.00', special_rule_code: null });
    const lines = [line({ service: lookalike, dialysisPrescription: true })];

    expect(lineIsFree(lines[0]!)).toBe(false);
    expect(lineTotalCents(lines[0]!)).toBe(2500);
    expect(hasEligibleMedication(lines)).toBe(false);
  });

  it('toggleCondition solo marca líneas elegibles', () => {
    const lines = [line({ service: epo }), line({ service: dialysisService })];
    const toggled = toggleCondition(lines, true);

    expect(toggled[0]!.dialysisPrescription).toBe(true);
    expect(toggled[1]!.dialysisPrescription).toBe(false);
  });

  it('un precio o cantidad mal formados no se convierten en cero', () => {
    const broken = line({ service: service({ id: 50, name: 'Roto', price: '' }) });

    expect(lineTotalCents(broken)).toBeNull();
  });
});
