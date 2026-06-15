import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptPreview } from './ReceiptPreview';
import type { ReceiptData } from '../../lib/api';

const printSpy = vi.fn();

vi.mock('react-to-print', () => ({
  useReactToPrint: () => printSpy,
}));

describe('ReceiptPreview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    printSpy.mockReset();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 hospital-validation-browser',
    });
    document.body.removeAttribute('data-printing-receipt');
    document.body.removeAttribute('data-receipt-width');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('waits for audited print callback before printing', async () => {
    const events: string[] = [];
    const onPrint = vi.fn(async () => {
      events.push('audit');
    });
    printSpy.mockImplementation(() => {
      events.push('print');
    });

    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={onPrint}
        onWidthChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['audit', 'print']);
  });

  it('does not print when audited print callback fails', async () => {
    const onPrint = vi.fn(async () => {
      throw new Error('Audit failed');
    });

    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={onPrint}
        onWidthChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));

    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(1));
    expect(printSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/no se pudo preparar la impresión/i)).toBeInTheDocument();
    expect(screen.getByText(/no repita la factura ni el cobro/i)).toBeInTheDocument();
  });

  it('shows a human recovery message when the print dialog cannot open', async () => {
    printSpy.mockImplementation(() => {
      throw new Error('Printer dialog failed');
    });

    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/no se pudo abrir la ventana de impresión/i)).toBeInTheDocument();
    expect(screen.getByText(/reimprima desde historial con motivo/i)).toBeInTheDocument();
    expect(document.body.dataset.receiptWidth).toBeUndefined();
    expect(document.body.dataset.printingReceipt).toBeUndefined();
  });

  it('sets and clears the active print paper width', async () => {
    const receipt = receiptFixture();
    receipt.width = '80mm';
    printSpy.mockImplementation(() => {
      expect(document.body.dataset.receiptWidth).toBe('80mm');
      expect(document.body.dataset.printingReceipt).toBe('true');
    });

    render(
      <ReceiptPreview
        receipt={receipt}
        onPrint={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.receiptWidth).toBeUndefined();
    expect(document.body.dataset.printingReceipt).toBeUndefined();
  });

  it('renders malformed historical receipt amounts as safe financial values', () => {
    const receipt = receiptFixture();
    receipt.invoice.subtotal = 'monto-danado';
    receipt.invoice.tax_amount = 'NaN';
    receipt.invoice.total = 'no-numero';
    receipt.invoice.paid_amount = '1.00';
    receipt.invoice.balance_due = '2.00';
    receipt.items[0].line_total = 'monto-danado';
    receipt.payments[0].amount = 'NaN';

    render(
      <ReceiptPreview
        receipt={receipt}
        onPrint={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).toContain('L. 1.00');
    expect(document.body.textContent).toContain('L. 2.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('presents the institutional receipt as the final printable receipt', () => {
    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
        onWidthChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'RECIBO INSTITUCIONAL' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'COMPROBANTE DE FACTURA' })).not.toBeInTheDocument();
    expect(screen.queryByText(/comprobante de compatibilidad/i)).not.toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('CAI')).toBeInTheDocument();
    expect(screen.getByText('Rango')).toBeInTheDocument();
    expect(screen.getByText('Vence')).toBeInTheDocument();
    expect(screen.getByText('TEST-CAI')).toBeInTheDocument();
  });
});

function receiptFixture(): ReceiptData {
  return {
    width: 'half_letter',
    hospital: {
      name: 'Hospital San Isidro',
      rtn: '08011999123456',
      address: 'Tocoa, Colon',
      slogan: null,
    },
    institutional: {
      template_mode: 'institutional',
      paper_size: 'half_letter',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaría de Salud Pública',
      location: 'Tocoa, Colon',
      footer_text: null,
      copy_label: 'Original',
      signature_label: 'Firma y sello del receptor de fondos',
    },
    fiscal: {
      cai: 'TEST-CAI',
      authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
      valid_until: '2026-12-31',
    },
    invoice: {
      id: 1,
      invoice_number: '000-001-01-00000001',
      patient_name: 'Maria Lopez',
      subtotal: '15.00',
      tax_amount: '2.25',
      discount_amount: '0.00',
      total: '17.25',
      paid_amount: '17.25',
      balance_due: '0.00',
      status: 'paid',
      issued_at: '2026-06-01T12:00:00',
      cashier: 'Cajero Validacion',
      tax_label: 'ISV',
      tax_rate: '15.00',
    },
    items: [
      {
        service_name: 'Glucosa',
        category_name: 'Laboratorio',
        quantity: '1.00',
        unit_price: '15.00',
        tax_amount: '2.25',
        line_total: '17.25',
        special_rule_code: null,
        special_rule_applied: false,
        notes: null,
      },
    ],
    payments: [
      {
        id: 1,
        method: 'cash',
        amount: '17.25',
        reference: null,
        paid_at: '2026-06-01T12:05:00',
        cashier: 'Cajero Validacion',
      },
    ],
  };
}
