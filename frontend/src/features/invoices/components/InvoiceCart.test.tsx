import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceCart, type CartItem } from './InvoiceCart';
import type { Service } from '../../../lib/api';

describe('InvoiceCart', () => {
  it('renders malformed service and preview amounts as safe financial labels', () => {
    render(
      <InvoiceCart
        items={[cartItemFixture({ service: serviceFixture({ price: 'monto-danado' }) })]}
        preview={{ subtotal: 'monto-danado', tax: 'NaN', total: 'no-numero' }}
        taxRate="15.00"
        onUpdateQuantity={vi.fn()}
        onUpdateDialysisPrescription={vi.fn()}
        onRemoveItem={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Hemograma')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('disables the dialysis prescription checkbox and shows auth warning when user lacks permission', () => {
    render(
      <InvoiceCart
        items={[cartItemFixture({ service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }) })]}
        preview={{ subtotal: '100.00', tax: '0.00', total: '100.00' }}
        taxRate="15.00"
        onUpdateQuantity={vi.fn()}
        onUpdateDialysisPrescription={vi.fn()}
        onRemoveItem={vi.fn()}
        onConfirm={vi.fn()}
        canMarkDialysisPrescription={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('Receta de diálisis (requiere autorización)')).toBeInTheDocument();
  });

  it('enables the dialysis prescription checkbox and shows gratis text when user has permission', () => {
    render(
      <InvoiceCart
        items={[cartItemFixture({ service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }) })]}
        preview={{ subtotal: '100.00', tax: '0.00', total: '100.00' }}
        taxRate="15.00"
        onUpdateQuantity={vi.fn()}
        onUpdateDialysisPrescription={vi.fn()}
        onRemoveItem={vi.fn()}
        onConfirm={vi.fn()}
        canMarkDialysisPrescription={true}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeEnabled();
    expect(screen.getByText('Receta de diálisis (gratis)')).toBeInTheDocument();
  });
});

function cartItemFixture(overrides: Partial<CartItem> = {}): CartItem {
  return {
    service: serviceFixture(),
    quantity: '1.00',
    dialysisPrescription: false,
    ...overrides,
  };
}

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Hemograma',
    aliases: null,
    slug: 'hemograma',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '120.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ...overrides,
  };
}
