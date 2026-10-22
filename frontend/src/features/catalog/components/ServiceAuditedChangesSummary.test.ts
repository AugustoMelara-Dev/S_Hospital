import { describe, expect, it } from 'vitest';
import { auditedServiceChanges } from './ServiceAuditedChangesSummary';

const source = {
  active: true,
  is_billable: true,
  price: '15.00',
  taxable: true,
  visible_in_billing: true,
};

describe('auditedServiceChanges', () => {
  it('publica el dinero en centavos, nunca como texto con prefijo escrito a mano', () => {
    const changes = auditedServiceChanges(source, { ...source, price: '20.00' });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      id: 'price',
      label: 'Tarifa',
      beforeCents: 1500,
      afterCents: 2000,
      beforeText: null,
      afterText: null,
    });
  });

  it('no declara un cambio de tarifa cuando el importe es el mismo', () => {
    expect(auditedServiceChanges(source, { ...source, price: '15.00' })).toEqual([]);
    expect(auditedServiceChanges(source, { ...source, price: '15.0' })).toEqual([]);
  });

  it('no declara un cambio de tarifa cuando un importe no se puede interpretar', () => {
    const changes = auditedServiceChanges(
      { ...source, price: 'monto-danado' },
      { ...source, price: '20.00', taxable: false },
    );

    expect(changes.map((change) => change.id)).toEqual(['tax']);
  });

  it('describe los cambios de estado con texto, sin inventar dinero', () => {
    const changes = auditedServiceChanges(source, {
      ...source,
      taxable: false,
      active: false,
      visible_in_billing: false,
      is_billable: false,
    });

    expect(changes.map((change) => change.id)).toEqual([
      'tax',
      'active',
      'visible_in_billing',
      'is_billable',
    ]);
    expect(changes.every((change) => change.beforeCents === null && change.afterCents === null)).toBe(true);
    expect(changes.map((change) => change.afterText)).toEqual(['No aplica', 'No', 'No', 'No']);
  });
});
