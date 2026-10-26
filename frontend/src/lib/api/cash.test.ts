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
  it('requests paginated searchable options while resolving a selected historical item', async () => {
    mockedRequest.mockResolvedValueOnce({ data: [], meta: { current_page: 2, per_page: 20, total: 70 }, selected: { value: '4', label: 'Turno histórico' } });
    await cash.getCashSessionOptions({ kind: 'sessions', search: 'Emergencia', page: 2, selectedId: 4 });
    const url = new URL(mockedRequest.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toBe('/api/cash-sessions/options');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ kind: 'sessions', search: 'Emergencia', page: '2', per_page: '20', selected_id: '4' });
  });

  it('sends history filters to the server instead of filtering one local page', async () => {
    mockedRequest.mockResolvedValueOnce({ data: [], meta: { current_page: 1, per_page: 10, total: 0 } });
    await cash.getCashSessions({ page: 1, perPage: 10, date_from: '2026-06-01', date_to: '2026-06-02', cash_register_id: 3, user_id: 7, difference: 'shortage' });
    const url = new URL(mockedRequest.mock.calls[0][0] as string, 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ date_from: '2026-06-01', date_to: '2026-06-02', cash_register_id: '3', user_id: '7', difference: 'shortage' });
  });
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('maps a missing current cash session payload to null', async () => {
    mockedRequest.mockResolvedValueOnce({});

    await expect(cash.getCurrentCashSession()).resolves.toBeNull();

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/current');
  });

  it('lists active cash registers from the server inventory', async () => {
    mockedRequest.mockResolvedValueOnce({
      data: [{ id: 2, code: 'AZB-QA', name: 'Caja Azul QA', active: true }],
    });

    await expect(cash.getCashRegisters()).resolves.toEqual([
      { id: 2, code: 'AZB-QA', name: 'Caja Azul QA', active: true },
    ]);
    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-registers');
  });

  it('can request the current closable cash session for supervisor rescue flow', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 8, status: 'open' } });

    await expect(cash.getCurrentCashSession({ scope: 'closable' })).resolves.toEqual({ id: 8, status: 'open' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/current?scope=closable');
  });

  it('allows opening cash session with a caller-managed idempotency key', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 7, status: 'open' } });

    await expect(cash.openCashSession(
      { opening_amount: '0.00', cash_register_id: 2, notes: null },
      { idempotencyKey: 'cash-open-attempt-1' },
    )).resolves.toEqual({ id: 7, status: 'open' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/open', {
      method: 'POST',
      idempotencyKey: 'cash-open-attempt-1',
      headers: { 'Idempotency-Key': 'cash-open-attempt-1' },
      body: JSON.stringify({ opening_amount: '0.00', cash_register_id: 2, notes: null }),
    });
  });

  it('allows closing cash session with a caller-managed idempotency key', async () => {
    mockedRequest.mockResolvedValueOnce({ data: { id: 7, status: 'closed' } });
    const closingBreakdown = {
      bills: { '500': 0, '200': 0, '100': 2, '50': 1, '20': 0, '10': 0, '5': 0, '2': 0, '1': 0 },
      other_amount: '0.00',
    };

    await expect(cash.closeCashSession(
      7,
      { closing_amount: '250.00', notes: 'Cierre sin diferencia', closing_breakdown: closingBreakdown },
      { idempotencyKey: 'cash-close-attempt-1' },
    )).resolves.toEqual({ id: 7, status: 'closed' });

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/7/close', {
      method: 'POST',
      idempotencyKey: 'cash-close-attempt-1',
      headers: { 'Idempotency-Key': 'cash-close-attempt-1' },
      body: JSON.stringify({ closing_amount: '250.00', notes: 'Cierre sin diferencia', closing_breakdown: closingBreakdown }),
    });
  });
});
