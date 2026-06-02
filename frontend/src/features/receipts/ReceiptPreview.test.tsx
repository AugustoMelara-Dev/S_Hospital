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
  });

  it('sets and clears the active print paper width', async () => {
    vi.useFakeTimers();
    const receipt = receiptFixture();
    receipt.width = '80mm';
    printSpy.mockImplementation(() => undefined);

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
    expect(document.body.dataset.receiptWidth).toBe('80mm');
    expect(document.body.dataset.printingReceipt).toBe('true');

    await vi.advanceTimersByTimeAsync(1000);

    expect(document.body.dataset.receiptWidth).toBeUndefined();
    expect(document.body.dataset.printingReceipt).toBeUndefined();
    vi.useRealTimers();
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
      secretariat_line: 'Secretaria de Salud Publica',
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
