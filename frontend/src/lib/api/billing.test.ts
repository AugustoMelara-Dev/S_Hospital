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

  it('allows payment registration to reuse a caller-managed idempotency key', async () => {
    const payment = { id: 44, status: 'posted' } as Payment;
    const invoice = { id: 12, status: 'paid' } as Invoice;
    mockedRequest.mockResolvedValueOnce({ data: { payment, invoice } });

    await expect(billing.registerPayment(
      12,
      { cash_session_id: 7, method: 'cash', amount: '17.25', reference: null },
      { idempotencyKey: 'payment-attempt-1' },
    )).resolves.toEqual({ payment, invoice });

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/payments', {
      method: 'POST',
      idempotencyKey: 'payment-attempt-1',
      headers: { 'Idempotency-Key': 'payment-attempt-1' },
      body: JSON.stringify({ cash_session_id: 7, method: 'cash', amount: '17.25', reference: null }),
    });
  });
});
