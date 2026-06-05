import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { billing } from './billing';
import type { Invoice, Payment, ReceiptData } from './types';

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

  it('posts reprint width with the required operational reason', async () => {
    const receipt = { width: 'half_letter' } as ReceiptData;
    mockedRequest.mockResolvedValueOnce({ data: { receipt } });

    await expect(billing.reprintInvoice(12, {
      width: 'half_letter',
      reason: 'Copia solicitada por paciente',
    })).resolves.toEqual(receipt);

    expect(mockedRequest).toHaveBeenCalledWith('/api/invoices/12/reprint', {
      method: 'POST',
      body: JSON.stringify({
        width: 'half_letter',
        reason: 'Copia solicitada por paciente',
      }),
    });
  });
});
