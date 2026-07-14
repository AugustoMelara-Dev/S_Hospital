import { describe, expect, it } from 'vitest';
import type { Category, Service } from '../../lib/api';
import { catalogOverlayState } from './CatalogView';

const categories: Category[] = [
  { id: 2, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
];

describe('CatalogView URL continuity', () => {
  it('resolves an existing service without changing the search query', () => {
    const params = new URLSearchParams('q=eritropoyetina&service=4');

    const state = catalogOverlayState(params, [erythropoietinFixture()], categories);

    expect(state).toMatchObject({
      serviceDrawerOpen: true,
      categoryDrawerOpen: false,
      editingService: { id: 4, name: 'Eritropoyetina' },
      editingCategory: null,
    });
    expect(params.get('q')).toBe('eritropoyetina');
  });

  it('hydrates create and category overlays from explicit URL parameters', () => {
    expect(catalogOverlayState(
      new URLSearchParams('q=eritropoyetina&panel=new-service'),
      [erythropoietinFixture()],
      categories,
    )).toMatchObject({ serviceDrawerOpen: true, editingService: null });

    expect(catalogOverlayState(
      new URLSearchParams('q=eritropoyetina&panel=new-category'),
      [erythropoietinFixture()],
      categories,
    )).toMatchObject({ categoryDrawerOpen: true, editingCategory: null });

    expect(catalogOverlayState(
      new URLSearchParams('q=eritropoyetina&edit_category=2'),
      [erythropoietinFixture()],
      categories,
    )).toMatchObject({
      categoryDrawerOpen: true,
      editingCategory: { id: 2, name: 'Medicamentos' },
    });
  });
});

function erythropoietinFixture(): Service {
  return {
    id: 4,
    category_id: 2,
    area_id: 3,
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
    special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    category: categories[0],
    area: { id: 3, name: 'Farmacia', slug: 'farmacia', active: true },
  };
}
