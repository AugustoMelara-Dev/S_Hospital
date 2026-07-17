import { type ComponentProps, type FormEvent } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceCart, type CartItem } from './InvoiceCart';
import type { Service } from '../../../lib/api';

describe('InvoiceCart', () => {
  it('labels the ticket as Cuenta actual with its line count and registered price rule', () => {
    renderCart();

    expect(screen.getByText('Cuenta actual')).toBeInTheDocument();
    expect(screen.getByLabelText('1 línea en la cuenta')).toBeInTheDocument();
    expect(screen.getByText(/precio registrado/i)).toHaveTextContent('L 120.00');
  });

  it('renders one compact account table without a promotional estimated-total block', () => {
    const { container } = renderCart({ actionLabel: 'Emitir y cobrar' });

    expect(container.querySelector('.ant-list')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /cuenta actual/i })).toBeVisible();
    expect(screen.getByText('Subtotal')).toBeVisible();
    expect(screen.getByText(/ISV/)).toBeVisible();
    expect(screen.getByText('Total')).toBeVisible();
    expect(screen.queryByText(/total estimado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emitir y cobrar/i })).toBeVisible();
  });

  it('keeps quantity controls operable and exposes the configured total CTA', () => {
    renderCart({ actionLabel: 'Cobrar L 138.00' });

    expect(screen.getByRole('button', { name: /disminuir cantidad/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /aumentar cantidad/i })).toBeEnabled();
    const action = screen.getByRole('button', { name: 'Cobrar L 138.00' });
    expect(action).toBeEnabled();
    expect(action).toHaveTextContent(/^Cobrar L 138\.00$/);
    expect(action.closest('[data-billing-cart-action]')).toBeInTheDocument();
  });

  it('prevents duplicate invoice confirmation from a rapid double action', () => {
    const onConfirm = vi.fn();
    renderCart({ onConfirm });

    const action = screen.getByRole('button', { name: /emitir factura/i });
    fireEvent.click(action);
    fireEvent.click(action);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders an accessible empty cart without treating it as an error', () => {
    renderCart({ items: [] });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/no hay servicios agregados/i);
    expect(status).toHaveTextContent(/nombre, area o categoria/i);
    expect(status).not.toHaveTextContent(/c[oó]digo/i);
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

    const items = within(screen.getByRole('table', { name: /cuenta actual/i })).getAllByRole('row').slice(1);
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

  it('shows the dialysis prescription only with permission and preserves its boolean callback', () => {
    const onUpdateDialysisPrescription = vi.fn();
    const { rerender } = renderCart({
      items: [cartItemFixture({ service: serviceFixture({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' }) })],
      canMarkDialysisPrescription: false,
      onUpdateDialysisPrescription,
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/receta de diálisis/i)).not.toBeInTheDocument();
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

  it('shows estimated line totals by quantity and erythropoietin prescription', () => {
    renderCart({
      items: [
        cartItemFixture({ quantity: '2.00', service: serviceFixture({ name: 'Hemograma', price: '120.00' }) }),
        cartItemFixture({
          dialysisPrescription: true,
          quantity: '3.00',
          service: serviceFixture({
            id: 2,
            name: 'Eritropoyetina',
            price: '25.00',
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          }),
        }),
      ],
      canMarkDialysisPrescription: true,
    });

    const rows = within(screen.getByRole('table', { name: /cuenta actual/i })).getAllByRole('row').slice(1);

    expect(within(rows[0]).getByText(/^importe$/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText('L 240.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/^importe$/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText('L 0.00')).toBeInTheDocument();
  });

  it('normalizes a legacy mixed EPO cart to one patient-level prescription decision', () => {
    const erythropoietin = serviceFixture({
      name: 'Eritropoyetina',
      price: '25.00',
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    });
    renderCart({
      items: [
        cartItemFixture({ service: { ...erythropoietin, id: 10 }, dialysisPrescription: true }),
        cartItemFixture({ service: { ...erythropoietin, id: 11 }, dialysisPrescription: false }),
      ],
      canMarkDialysisPrescription: true,
    });

    const rows = within(screen.getByRole('table', { name: /cuenta actual/i })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('L 0.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('L 0.00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /paciente con receta de di.lisis/i })).toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    rows.forEach((row) => expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument());
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

  it('keeps the fiscal preview complete with exempt amount and a fixed action zone', () => {
    const { container } = renderCart({
      items: [cartItemFixture({ service: serviceFixture({ taxable: false }) })],
      preview: { subtotal: '120.00', exempt: '120.00', tax: '0.00', total: '120.00' },
    });

    expect(screen.getByText('Exento')).toBeVisible();
    expect(screen.getAllByText('L 120.00').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-billing-cart-lines]')).toHaveClass('overflow-y-auto');
    expect(container.querySelector('[data-billing-cart-action]')).toHaveClass('shrink-0');
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
