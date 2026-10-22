import { describe, expect, it } from 'vitest';
import type { Service } from './api';
import { getServiceBillingSummary } from './serviceBilling';

describe('getServiceBillingSummary', () => {
  it('describes erythropoietin with the current catalog tariff instead of a fixed amount', () => {
    const summary = getServiceBillingSummary(serviceFixture({
      price: '47.50',
      taxable: true,
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    }));

    expect(summary.reasons).toContain(
      'Gratis con receta de diálisis autorizada; sin receta se cobra la tarifa vigente del catálogo.',
    );
    expect(summary.reasons.join(' ')).not.toMatch(/25[.,]00/);
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
    price: '25.00',
    taxable: false,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    ...overrides,
  };
}
