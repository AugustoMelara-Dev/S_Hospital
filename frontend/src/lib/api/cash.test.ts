import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { cash } from './cash';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('cash api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('maps a missing current cash session payload to null', async () => {
    mockedRequest.mockResolvedValueOnce({});

    await expect(cash.getCurrentCashSession()).resolves.toBeNull();

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/current');
  });

  it('can request the current closable cash session for supervisor rescue flow', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 8, status: 'open' } });

    await expect(cash.getCurrentCashSession({ scope: 'closable' })).resolves.toEqual({ id: 8, status: 'open' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/current?scope=closable');
  });

  it('allows opening cash session with a caller-managed idempotency key', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 7, status: 'open' } });

    await expect(cash.openCashSession(
      { opening_amount: '0.00', notes: null },
      { idempotencyKey: 'cash-open-attempt-1' },
    )).resolves.toEqual({ id: 7, status: 'open' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/open', {
      method: 'POST',
      idempotencyKey: 'cash-open-attempt-1',
      headers: { 'Idempotency-Key': 'cash-open-attempt-1' },
      body: JSON.stringify({ opening_amount: '0.00', notes: null }),
    });
  });

  it('allows closing cash session with a caller-managed idempotency key', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 7, status: 'closed' } });

    await expect(cash.closeCashSession(
      7,
      { closing_amount: '250.00', notes: 'Cierre sin diferencia' },
      { idempotencyKey: 'cash-close-attempt-1' },
    )).resolves.toEqual({ id: 7, status: 'closed' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/7/close', {
      method: 'POST',
      idempotencyKey: 'cash-close-attempt-1',
      headers: { 'Idempotency-Key': 'cash-close-attempt-1' },
      body: JSON.stringify({ closing_amount: '250.00', notes: 'Cierre sin diferencia' }),
    });
  });
});
