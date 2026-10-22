import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { billing } from './billing';
import type { Invoice, Payment } from './types';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('billing api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('posts payment reversal reasons to the operational void endpoint', async () => {
    const payment = { id: 34, status: 'void' } as Payment;
    const invoice = { id: 12, status: 'issued' } as Invoice;
    mockedRequest.mockResolvedValueOnce({ data: { payment, invoice } });

    await expect(billing.voidPayment(12, 34, { reason: 'Cobro duplicado por error' }))
      .resolves.toEqual({ payment, invoice });

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/payments/34/void', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cobro duplicado por error' }),
    });
  });

  it('allows invoice voids to reuse a caller-managed idempotency key', async () => {
    const invoice = { id: 12, status: 'void' } as Invoice;
    mockedRequest.mockResolvedValueOnce({ data: invoice });

    await expect(billing.voidInvoice(
      12,
      'Factura duplicada por error',
      { idempotencyKey: 'void-attempt-1' },
    )).resolves.toBe(invoice);

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/void', {
      method: 'POST',
      idempotencyKey: 'void-attempt-1',
      headers: { 'Idempotency-Key': 'void-attempt-1' },
      body: JSON.stringify({ reason: 'Factura duplicada por error' }),
    });
  });

  it('allows invoice reversals to reuse a caller-managed idempotency key', async () => {
    const invoice = { id: 12, status: 'void' } as Invoice;
    mockedRequest.mockResolvedValueOnce({ data: invoice });

    await expect(billing.reverseInvoice(
      12,
      'Pago aplicado a factura equivocada',
      { idempotencyKey: 'reverse-attempt-1' },
    )).resolves.toBe(invoice);

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/reverse', {
      method: 'POST',
      idempotencyKey: 'reverse-attempt-1',
      headers: { 'Idempotency-Key': 'reverse-attempt-1' },
      body: JSON.stringify({ reason: 'Pago aplicado a factura equivocada' }),
    });
  });

  it('allows historical receipt reprints to reuse a caller-managed idempotency key', async () => {
    const receipt = { invoice_id: 12, width: 'half_letter' };
    mockedRequest.mockResolvedValueOnce({ data: { receipt } });

    await expect(billing.reprintInvoice(
      12,
      { width: 'half_letter', reason: 'Copia solicitada por auditoria' },
      { idempotencyKey: 'historical-reprint-attempt-1' },
    )).resolves.toBe(receipt);

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/reprint', {
      method: 'POST',
      idempotencyKey: 'historical-reprint-attempt-1',
      headers: { 'Idempotency-Key': 'historical-reprint-attempt-1' },
      body: JSON.stringify({ width: 'half_letter', reason: 'Copia solicitada por auditoria' }),
    });
  });

  it('allows payment registration to reuse a caller-managed idempotency key', async () => {
    const payment = { id: 44, status: 'posted' } as Payment;
    const invoice = { id: 12, status: 'paid' } as Invoice;
    const result = {
      payment,
      invoice,
      institutional_receipt: null,
      institutional_receipt_error: 'Serie institucional no configurada.',
      receipt_outcome: 'recovery_required' as const,
    };
    mockedRequest.mockResolvedValueOnce({ data: result });

    await expect(billing.registerPayment(
      12,
      { cash_session_id: 7, method: 'cash', amount: '17.25', reference: null },
      { idempotencyKey: 'payment-attempt-1' },
    )).resolves.toEqual(result);

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/payments', {
      method: 'POST',
      idempotencyKey: 'payment-attempt-1',
      headers: { 'Idempotency-Key': 'payment-attempt-1' },
      body: JSON.stringify({ cash_session_id: 7, method: 'cash', amount: '17.25', reference: null }),
    });
  });

  it('requests the institutional draft without emitting an invoice', async () => {
    const payload = {
      patient_name: 'Ana López',
      items: [{ service_id: 42, quantity: '1' }],
    };
    const draft = {
      draft: true as const,
      watermark: 'BORRADOR - SIN VALIDEZ',
      reserved_number: false as const,
      html: '<!doctype html><html><body>Vista previa</body></html>',
      document: {
        paper: { kind: 'letter', label: 'Carta', orientation: 'portrait', width_pt: 612, height_pt: 792 },
        copies: { count: 1, labels: ['Original'], destinations: ['Paciente'] },
        page_count: 1,
        sheet_count: 1,
        requested_composition: 'single',
        used_composition: 'single',
        distribution: null,
        alternative_output: null,
        alternative_reason: null,
        draft: true as const,
        headline: 'Comprobante borrador',
        print_instruction: 'Vista previa',
        sheet_assumption: 'Una hoja',
      },
      valuation: {} as never,
    };
    mockedRequest.mockResolvedValueOnce({ data: draft });

    await expect(billing.previewInvoiceReceipt(payload)).resolves.toBe(draft);
    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/receipt-preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });
});
