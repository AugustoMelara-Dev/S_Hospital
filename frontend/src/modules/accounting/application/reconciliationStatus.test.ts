import { describe, expect, it } from 'vitest';
import { buildReconciliationStatus } from './reconciliationStatus';

describe('buildReconciliationStatus', () => {
  it('marks a fully reconciled session as ready', () => {
    expect(buildReconciliationStatus({
      pending_invoice_count: 0,
      pending_amount: '0.00',
      missing_institutional_receipt_count: 0,
      reversed_payments_count: 0,
      reversed_payments_total: '0.00',
    })).toEqual({
      state: 'ready',
      blockers: [],
      reversedPayments: { count: 0, total: '0.00' },
      expenses: { supported: false },
    });
  });

  it('keeps invoice and receipt blockers as separate actionable facts', () => {
    const status = buildReconciliationStatus({
      pending_invoice_count: 2,
      pending_amount: '35.50',
      missing_institutional_receipt_count: 1,
      reversed_payments_count: 0,
      reversed_payments_total: '0.00',
    });

    expect(status.state).toBe('blocked');
    expect(status.blockers).toEqual([
      { kind: 'pending_invoices', count: 2, amount: '35.50' },
      { kind: 'missing_receipts', count: 1 },
    ]);
  });

  it('reports reversals without treating them as a close blocker', () => {
    const status = buildReconciliationStatus({
      pending_invoice_count: 0,
      pending_amount: '0.00',
      missing_institutional_receipt_count: 0,
      reversed_payments_count: 3,
      reversed_payments_total: '42.75',
    });

    expect(status.state).toBe('ready');
    expect(status.reversedPayments).toEqual({ count: 3, total: '42.75' });
  });

  it('uses safe zero values when an older session payload omits new facts', () => {
    expect(buildReconciliationStatus({})).toMatchObject({
      state: 'ready',
      blockers: [],
      reversedPayments: { count: 0, total: '0.00' },
    });
  });
});
