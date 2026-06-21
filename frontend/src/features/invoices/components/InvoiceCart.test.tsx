import { type ComponentProps, type FormEvent } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceCart, type CartItem } from './InvoiceCart';
import type { Service } from '../../../lib/api';

describe('InvoiceCart', () => {
  it('renders an accessible empty cart without treating it as an error', () => {
    renderCart({ items: [] });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/no hay servicios agregados/i);
    expect(screen.getByRole('button', { name: /emitir factura: agregar servicios/i })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders lines in order with service identity, category, area and safe amounts', () => {
    renderCart({
      items: [
        cartItemFixture({ service: serviceFixture({ id: 10, name: 'Primer servicio', price: 'monto-danado' }) }),
        cartItemFixture({ service: serviceFixture({ id: 20, name: 'Segundo servicio', price: '0.00' }) }),
      ],
      preview: { subtotal: 'monto-danado', tax: 'NaN', total: 'no-numero' },
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Primer servicio')).toBeInTheDocument();
    expect(within(items[1]).getByText('Segundo servicio')).toBeInTheDocument();
    expect(screen.getAllByText('Laboratorio').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('keeps quantity increment, decrement, manual change and remove callbacks exact', () => {
    const onUpdateQuantity = vi.fn();
    const onRemoveItem = vi.fn();
    renderCart({
      items: [cartItemFixture({ quantity: '2.00' })],
      onUpdateQuantity,
      onRemoveItem,
    });

    fireEvent.click(screen.getByRole('button', { name: /disminuir cantidad/i }));
    fireEvent.click(screen.getByRole('button', { name: /aumentar cantidad/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /^cantidad de hemograma$/i }), { target: { value: '3.50' } });
    fireEvent.click(screen.getByRole('button', { name: /quitar hemograma/i }));

    expect(onUpdateQuantity).toHaveBeenNthCalledWith(1, 0, '1');
    expect(onUpdateQuantity).toHaveBeenNthCalledWith(2, 0, '3');
    expect(onUpdateQuantity).toHaveBeenNthCalledWith(3, 0, '3.50');
    expect(onRemoveItem).toHaveBeenCalledWith(0);
  });

  it('keeps cart buttons from submitting a parent form', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onConfirm = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        {cartElement({ onConfirm })}
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /aumentar cantidad/i }));
    fireEvent.click(screen.getByRole('button', { name: /quitar hemograma/i }));
    fireEvent.click(screen.getByRole('button', { name: /emitir factura/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('preserves dialysis prescription gating and boolean callback', () => {
    const onUpdateDialysisPrescription = vi.fn();
    const { rerender } = renderCart({
      items: [cartItemFixture({ service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }) })],
      canMarkDialysisPrescription: false,
      onUpdateDialysisPrescription,
    });

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText(/receta de diálisis \(requiere autorización\)/i)).toBeInTheDocument();
    expect(onUpdateDialysisPrescription).not.toHaveBeenCalled();

    rerender(cartElement({
      items: [cartItemFixture({ service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }) })],
      canMarkDialysisPrescription: true,
      onUpdateDialysisPrescription,
    }));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeEnabled();
    fireEvent.click(checkbox);
    expect(onUpdateDialysisPrescription).toHaveBeenCalledWith(0, true);
  });

  it('does not activate dialysis prescription by default and keeps the free rule textual', () => {
    renderCart({
      items: [cartItemFixture({
        dialysisPrescription: true,
        service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }),
      })],
      canMarkDialysisPrescription: true,
    });

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/\(gratis - receta diálisis\)/i)).toBeInTheDocument();
  });

  it('announces disabled blockers and preserves the configured action label', () => {
    renderCart({
      disabled: true,
      disabledReasons: ['Ingrese el nombre del paciente para emitir.'],
      actionLabel: 'Emitir y cobrar',
    });

    expect(screen.getByRole('button', { name: /emitir y cobrar: ingrese paciente/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ingrese el nombre del paciente/i);
  });

  it('does not add unsupported discount, editable price or drag controls', () => {
    renderCart();

    expect(screen.queryByLabelText(/descuento|precio manual|precio editable/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arrastrar|reordenar/i })).not.toBeInTheDocument();
  });
});

function renderCart(overrides: Partial<ComponentProps<typeof InvoiceCart>> = {}) {
  return render(cartElement(overrides));
}

function cartElement(overrides: Partial<ComponentProps<typeof InvoiceCart>> = {}) {
  return (
    <InvoiceCart
      items={[cartItemFixture()]}
      preview={{ subtotal: '120.00', tax: '18.00', total: '138.00' }}
      taxRate="15.00"
      onUpdateQuantity={vi.fn()}
      onUpdateDialysisPrescription={vi.fn()}
      onRemoveItem={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />
  );
}

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
