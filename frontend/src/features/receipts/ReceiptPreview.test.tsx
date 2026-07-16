import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptPreview } from './ReceiptPreview';
import type { ReceiptData } from '../../lib/api';

const printSpy = vi.fn();

describe('ReceiptPreview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    printSpy.mockReset();
    vi.stubGlobal('print', printSpy);
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 hospital-validation-browser',
    });
    document.body.removeAttribute('data-printing-receipt');
    document.body.removeAttribute('data-receipt-width');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not auto print when a retired autoPrint prop is present', async () => {
    vi.useFakeTimers();
    const onPrint = vi.fn();

    render(
      <ReceiptPreview
        {...({
          receipt: receiptFixture(),
          autoPrint: true,
          onPrint,
        } as unknown as React.ComponentProps<typeof ReceiptPreview>)}
      />,
    );

    await vi.advanceTimersByTimeAsync(500);

    expect(onPrint).not.toHaveBeenCalled();
    expect(printSpy).not.toHaveBeenCalled();
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.receiptWidth).toBeUndefined();
    expect(document.body.dataset.printingReceipt).toBeUndefined();
  });

  it('does not expose manual paper size controls in the print preview', () => {
    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
      />,
    );

    expect(screen.queryByRole('combobox', { name: /tama/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tam/i)).not.toBeInTheDocument();
  });

  it('groups receipt actions outside the printable document with accessible targets', () => {
    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
        onNewInvoice={vi.fn()}
      />,
    );

    const actions = screen.getByRole('group', { name: 'Acciones del comprobante histórico' });
    expect(within(actions).getByRole('button', { name: 'Imprimir' })).toHaveClass('min-h-11');
    expect(within(actions).getByRole('button', { name: 'Nueva factura' })).toHaveClass('min-h-11');
    expect(within(document.querySelector('[data-receipt-print-root]') as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('keeps the 58 mm compatibility print root when returned by the API', () => {
    const receipt = receiptFixture();
    receipt.width = '58mm';

    render(<ReceiptPreview receipt={receipt} onPrint={vi.fn()} />);

    expect(document.querySelector('[data-receipt-print-root]')).toHaveClass('receipt-58mm');
    expect(screen.queryByRole('columnheader', { name: 'Precio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /ISV/i })).not.toBeInTheDocument();
  });

  it('preserves a valid custom paper contract instead of falling back to half letter', () => {
    const receipt = receiptFixture();
    receipt.width = 'custom';
    receipt.institutional = {
      ...receipt.institutional!,
      paper_width_mm: '180.00',
      paper_height_mm: '100.00',
    };

    render(<ReceiptPreview receipt={receipt} onPrint={vi.fn()} />);

    const printRoot = document.querySelector('[data-receipt-print-root]');
    expect(printRoot).toHaveClass('receipt-custom');
    expect(printRoot).toHaveStyle({
      '--receipt-custom-width': '180mm',
      '--receipt-custom-height': '100mm',
    });
    expect(document.querySelector('[data-receipt-custom-page]')).toHaveTextContent(
      '@page receipt-custom { size: 180mm 100mm; margin: 6mm; }',
    );
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
      />,
    );

    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).toContain('L. 1.00');
    expect(document.body.textContent).toContain('L. 2.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('clearly labels the legacy fallback as a historical non-institutional invoice', () => {
    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'COMPROBANTE HISTÓRICO DE FACTURA' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'RECIBO INSTITUCIONAL' })).not.toBeInTheDocument();
    expect(screen.getByText(/documento histórico no institucional/i)).toBeInTheDocument();
    expect(screen.getByText(/no asigna correlativo de recibo/i)).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Factura No.' })).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('RTN: 08011999123456')).toBeInTheDocument();
    expect(screen.getByText('Tel. 2444-0000')).toBeInTheDocument();
    expect(screen.getByText('Caja #7')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Exento' })).toBeInTheDocument();
    expect(screen.getByText('DIECISIETE LEMPIRAS CON 25/100 CENTAVOS')).toBeInTheDocument();
    const printRoot = document.querySelector('[data-receipt-print-root]');
    expect(printRoot).toBeInTheDocument();
    expect(printRoot?.textContent).toMatch(/CAI|TEST-CAI/i);
    expect(printRoot?.textContent).toMatch(/Rango autorizado|000-001-01-99999999/i);
    expect(printRoot?.textContent).toMatch(/Fecha límite de emisión|31\/12\/2026/i);
  });

  it('omits the fiscal authorization block when the historical invoice has no fiscal data', () => {
    const receipt = receiptFixture();
    receipt.fiscal = {
      cai: null,
      authorized_range: null,
      valid_until: null,
    };

    render(<ReceiptPreview receipt={receipt} onPrint={vi.fn()} />);

    const printRoot = document.querySelector('[data-receipt-print-root]');
    expect(printRoot?.textContent).not.toMatch(/\bCAI\b|Rango autorizado|Fecha límite de emisión/i);
  });

  it('keeps every mixed payment method, amount, reference and date in the historical fallback', () => {
    const receipt = receiptFixture();
    receipt.payments = [
      {
        method: 'cash',
        amount: '10.00',
        reference: 'EF-001',
        paid_at: '2026-06-01T12:05:00',
        cashier: 'Cajero Uno',
      },
      {
        method: 'transfer',
        amount: '7.25',
        reference: 'TRX-FINAL',
        paid_at: '2026-06-01T12:10:00',
        cashier: 'Cajero Dos',
      },
    ];

    render(<ReceiptPreview receipt={receipt} onPrint={vi.fn()} />);

    const payments = screen.getByRole('heading', { name: 'Pagos' }).nextElementSibling;
    expect(payments).toHaveTextContent('Efectivo');
    expect(payments).toHaveTextContent('L. 10.00');
    expect(payments).toHaveTextContent('EF-001');
    expect(payments).toHaveTextContent('Transferencia');
    expect(payments).toHaveTextContent('L. 7.25');
    expect(payments).toHaveTextContent('TRX-FINAL');
    expect(payments?.querySelector('time[datetime="2026-06-01T12:05:00"]')).toBeInTheDocument();
    expect(payments?.querySelector('time[datetime="2026-06-01T12:10:00"]')).toBeInTheDocument();
  });

  it('renders semantic receipt tables while keeping controls outside the printable document', () => {
    render(
      <ReceiptPreview
        receipt={receiptFixture()}
        onPrint={vi.fn()}
      />,
    );

    const printRoot = document.querySelector('[data-receipt-print-root]');
    expect(printRoot).toBeInTheDocument();

    const printable = within(printRoot as HTMLElement);
    expect(printable.getByRole('table', { name: /detalle de servicios/i })).toBeInTheDocument();
    expect(printable.getByRole('columnheader', { name: /concepto \/ servicio/i })).toBeInTheDocument();
    expect(printable.getByRole('columnheader', { name: /importe/i })).toBeInTheDocument();
    expect(printable.getByRole('rowheader', { name: /^total$/i })).toBeInTheDocument();
    expect(printable.queryByRole('button', { name: /imprimir/i })).not.toBeInTheDocument();
    expect(printable.queryByLabelText(/tamaño del recibo/i)).not.toBeInTheDocument();
    expect(printRoot?.textContent).not.toMatch(/qr|barcode|codigo interno|código interno/i);
  });

  it('keeps the financial summary compact without making the signature footer part of the same indivisible block', () => {
    render(<ReceiptPreview receipt={receiptFixture()} onPrint={vi.fn()} />);

    const printRoot = document.querySelector('[data-receipt-print-root]');
    const summary = printRoot?.querySelector('[data-receipt-summary]');
    const footer = printRoot?.querySelector('footer');

    expect(summary).toHaveClass('receipt-summary');
    expect(summary).toContainElement(within(printRoot as HTMLElement).getByRole('rowheader', { name: /^total$/i }));
    expect(summary).not.toContainElement(footer as HTMLElement);
    expect(footer).toHaveClass('receipt-footer');
  });

  it('keeps long service names printable without exposing QR or barcode artifacts', () => {
    const receipt = receiptFixture();
    const longServiceName =
      'Ultrasonido abdominal completo con evaluacion hepatobiliar pancreatica renal pelvica y descripcion extendida solicitada por emergencia hospitalaria';
    receipt.width = 'half_letter';
    receipt.items[0].service_name = longServiceName;
    receipt.items[0].category_name = 'Imagenologia y estudios especiales';

    render(
      <ReceiptPreview
        receipt={receipt}
        onPrint={vi.fn()}
      />,
    );

    const printRoot = document.querySelector('[data-receipt-print-root]');
    const serviceName = screen.getByText(longServiceName);

    expect(printRoot).toBeInTheDocument();
    expect(printRoot).toHaveClass('receipt-half-letter');
    expect(serviceName.closest('.item-name')).toBeInTheDocument();
    expect(printRoot?.querySelector('svg,img,canvas')).toBeNull();
    expect(printRoot?.textContent).not.toMatch(/qr|barcode|codigo de barras|scan|codigo interno/i);
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
      phone: '2444-0000',
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
      cash_register_label: 'Caja #7',
      tax_label: 'ISV',
      tax_rate: '15.00',
    },
    amount_words: 'DIECISIETE LEMPIRAS CON 25/100 CENTAVOS',
    exempt_amount: '0.00',
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
        method: 'cash',
        amount: '17.25',
        reference: null,
        paid_at: '2026-06-01T12:05:00',
        cashier: 'Cajero Validacion',
      },
    ],
  };
}
