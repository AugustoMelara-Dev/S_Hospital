import { describe, expect, it } from 'vitest';
import type { Service } from '@/lib/api';
import { serviceOperationalNotes } from './serviceOperationalNotes';

describe('serviceOperationalNotes', () => {
  it('cita la tarifa vigente del catálogo y no una cifra histórica escrita a mano', () => {
    const notes = serviceOperationalNotes(serviceFixture({ price: '30.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }));

    expect(notes[0].id).toBe('dialysis-prescription');
    expect(notes[0].moneyCents).toBe(3000);
    expect(notes[0].text).toMatch(/tarifa vigente del catálogo/i);
    expect(notes.every((note) => !/\d/.test(note.text))).toBe(true);
  });

  it('no publica ningún importe cuando la tarifa no está configurada', () => {
    const notes = serviceOperationalNotes(serviceFixture({ price: '0.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }));

    const rule = notes.find((note) => note.id === 'dialysis-prescription');

    expect(rule?.moneyCents).toBeUndefined();
    expect(rule?.text).toMatch(/tarifa vigente del catálogo/i);
    expect(notes.some((note) => note.id === 'missing-price')).toBe(true);
  });

  it('describe la tarifa ausente sin mostrar un cero falso', () => {
    const notes = serviceOperationalNotes(serviceFixture({ price: 'monto-danado' }));

    expect(notes).toEqual([{ id: 'missing-price', text: expect.stringMatching(/revise la tarifa/i) }]);
    expect(notes.some((note) => note.moneyCents !== undefined)).toBe(false);
  });

  it('declara las excepciones de disponibilidad antes que la tarifa', () => {
    const notes = serviceOperationalNotes(serviceFixture({ active: false, visible_in_billing: false, is_billable: false }));

    expect(notes.map((note) => note.id)).toEqual(['inactive', 'hidden-in-billing', 'not-billable']);
  });
});

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Eritropoyetina',
    aliases: null,
    slug: 'eritropoyetina',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '15.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
    area: { id: 1, name: 'Dialisis', slug: 'dialisis', active: true },
    ...overrides,
  };
}
