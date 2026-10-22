import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Invoice, InvoiceItem } from '@/lib/api';
import type { InvoiceActionPermissions } from '@/modules/invoices/application/invoiceActionPolicy';
import { RecibosDetailPanel } from './RecibosDetailPanel';

/**
 * T-UI-15: el detalle debe renderizar las líneas reales que devuelve
 * `GET /api/invoices/{id}` (`items`), no solo sus totales. Guarda la forma del
 * contrato: concepto, cantidad, precio, ajuste por regla e importe por línea.
 */

function itemFixture(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 1,
    service_id: 11,
    service_name: 'Glucosa basal',
    category_id: 1,
    category_name: 'Laboratorio',
    quantity: '1.00',
    unit_price: '137.39',
    tax_rate: '15.00',
    tax_amount: '20.61',
    line_subtotal: '137.39',
    line_total: '158.00',
    special_rule_code: null,
    special_rule_applied: false,
    notes: null,
    ...overrides,
  };
}

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 501,
    invoice_number: 'A-0001',
    patient_name: 'Maria Lopez',
    subtotal: '217.39',
    tax_amount: '32.61',
    discount_amount: '0.00',
    total: '250.00',
    paid_amount: '0.00',
    balance_due: '250.00',
    status: 'issued',
    issued_at: '2026-09-18T09:30:00-06:00',
    items: [],
    ...overrides,
  };
}

const NO_PERMISSIONS: InvoiceActionPermissions = {
  canIssueInstitutionalReceipt: false,
  canCollectPayment: false,
  canOperateAnyInvoice: false,
  canReprint: false,
  canReprintAny: false,
  canReverse: false,
  canViewReceipt: false,
  canVoid: false,
  isOwnInvoiceFromToday: false,
};

function renderPanel(invoice: Invoice) {
  return render(
    <RecibosDetailPanel
      invoice={invoice}
      loading={false}
      error=""
      loadingActionInvoiceId={null}
      permissions={NO_PERMISSIONS}
      printInfo={null}
      onClose={vi.fn()}
      onRetry={vi.fn()}
      onOpenReceipt={vi.fn()}
      onDownload={vi.fn()}
      onGenerateReceipt={vi.fn()}
      onReprint={vi.fn()}
      onPrepareAction={vi.fn()}
      onCollect={vi.fn()}
    />,
  );
}

describe('RecibosDetailPanel — líneas de la cuenta', () => {
  it('renderiza concepto, cantidad, precio, ajuste e importe de cada línea del detalle', () => {
    const invoice = invoiceFixture({
      items: [
        itemFixture(),
        itemFixture({
          id: 2,
          service_id: 12,
          service_name: 'Hemograma completo',
          quantity: '2.00',
          unit_price: '40.00',
          tax_amount: '12.00',
          line_subtotal: '80.00',
          line_total: '92.00',
        }),
        itemFixture({
          id: 3,
          service_id: 33,
          service_name: 'Eritropoyetina',
          category_name: 'Medicamentos',
          unit_price: '2500.00',
          tax_rate: '0.00',
          tax_amount: '0.00',
          line_subtotal: '0.00',
          line_total: '0.00',
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          special_rule_applied: true,
        }),
      ],
    });

    renderPanel(invoice);

    const table = screen.getByRole('table', { name: /líneas de la operación/i });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4); // encabezado + 3 líneas

    const glucose = rows[1];
    expect(within(glucose).getByText('Glucosa basal')).toBeInTheDocument();
    expect(within(glucose).getByText('1.00')).toBeInTheDocument();
    expect(within(glucose).getByText('L. 137.39')).toBeInTheDocument();
    expect(within(glucose).getByText('L. 158.00')).toBeInTheDocument();
    expect(within(glucose).getByText('—')).toBeInTheDocument();

    const hemogram = rows[2];
    expect(within(hemogram).getByText('Hemograma completo')).toBeInTheDocument();
    expect(within(hemogram).getByText('2.00')).toBeInTheDocument();
    expect(within(hemogram).getByText('L. 40.00')).toBeInTheDocument();
    expect(within(hemogram).getByText('L. 92.00')).toBeInTheDocument();

    const erythropoietin = rows[3];
    expect(within(erythropoietin).getByText('Eritropoyetina')).toBeInTheDocument();
    expect(within(erythropoietin).getByText('L. 2,500.00')).toBeInTheDocument();
    expect(within(erythropoietin).getByText(/sin cobro por receta/i)).toBeInTheDocument();
    // El detalle todavía no entrega el ajuste de la línea: se declara el dato
    // como no disponible y NUNCA se pinta un `L 0.00` de ajuste inventado.
    expect(within(erythropoietin).getByText('Dato histórico no disponible')).toBeInTheDocument();
    // El importe real de la línea sí es cero y se imprime.
    expect(within(erythropoietin).getByText('L. 0.00')).toBeInTheDocument();

    expect(screen.queryByText(/no tiene líneas registradas/i)).not.toBeInTheDocument();
  });

  it('muestra el ajuste real por línea cuando el detalle sí lo entrega', () => {
    const adjusted = itemFixture({
      id: 9,
      service_name: 'Hemograma completo',
      special_rule_applied: true,
      rule_adjustment_cents: 1200,
      rule_adjustment_persisted: true,
    });

    renderPanel(invoiceFixture({ items: [adjusted] }));

    const table = screen.getByRole('table', { name: /líneas de la operación/i });
    const row = within(table).getAllByRole('row')[1];

    expect(within(row).getByText('L. 12.00')).toBeInTheDocument();
    expect(within(row).queryByText('Dato histórico no disponible')).not.toBeInTheDocument();
  });

  it('imprime el ajuste de la línea EPO tal como llega del detalle real (C2-B8)', () => {
    // Payload real de `GET /api/invoices/19`: Eritropoyetina, precio efectivo
    // 0.00, precio registrado 25.00 y ajuste 25.00 (magnitud positiva).
    const erythropoietin = itemFixture({
      id: 33,
      service_id: 122,
      service_name: 'Eritropoyetina',
      category_name: 'Medicamentos',
      unit_price: '0.00',
      unit_price_registered_cents: 2500,
      rule_adjustment_cents: 2500,
      rule_adjustment_persisted: true,
      tax_rate: '0.00',
      tax_amount: '0.00',
      line_subtotal: '0.00',
      line_total: '0.00',
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      special_rule_applied: true,
    });

    renderPanel(invoiceFixture({ items: [erythropoietin] }));

    const table = screen.getByRole('table', { name: /líneas de la operación/i });
    const row = within(table).getAllByRole('row')[1];

    expect(within(row).getByText('L. 25.00')).toBeInTheDocument();
    expect(within(row).getByText(/Ajuste por regla: menos/i)).toBeInTheDocument();
    expect(within(row).queryByText('Dato histórico no disponible')).not.toBeInTheDocument();
  });

  it('agrupa el número, el paciente y el estado en la cabecera de la operación', () => {
    renderPanel(invoiceFixture({ items: [itemFixture()] }));

    const panel = screen.getByRole('complementary', { name: /detalle de la operación/i });

    expect(within(panel).getByRole('heading', { name: 'A-0001' })).toBeInTheDocument();
    expect(within(panel).getByText('Maria Lopez')).toBeInTheDocument();
    expect(within(panel).getByText('Pendiente de cobro')).toBeInTheDocument();
  });

  it('mantiene las líneas junto al resumen monetario en una sola sección', () => {
    renderPanel(invoiceFixture({ items: [itemFixture()] }));

    const account = screen.getByRole('region', { name: /^cuenta$/i });

    expect(within(account).getByRole('table', { name: /líneas de la operación/i })).toBeInTheDocument();
    expect(within(account).getByText('Total')).toBeInTheDocument();
    expect(within(account).getByText('Saldo')).toBeInTheDocument();
    expect(within(account).queryByText(/paciente/i)).not.toBeInTheDocument();
  });

  it('mantiene el vacío explícito cuando el servidor devuelve items vacíos', () => {
    renderPanel(invoiceFixture({ items: [] }));

    expect(screen.getByText(/no tiene líneas registradas/i)).toBeInTheDocument();
  });
});
