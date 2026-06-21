import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionSummary } from './SessionSummary';
import type { CashSession } from '@/lib/api';

describe('SessionSummary', () => {
  it('renders malformed session amounts and invalid differences as safe financial labels', () => {
    render(
      <SessionSummary
        session={cashSessionFixture({
          opening_amount: 'monto-danado',
          expected_amount: 'NaN',
          expected_cash_amount: 'no-numero',
          payments_by_method: { cash: 'monto-danado', transfer: '0.00', card: '0.00', other: '0.00' },
          pending_amount: 'undefined',
        })}
        closingAmount="monto-danado"
        difference={Number.NaN}
      />,
    );

    expect(screen.getByText('Monto Apertura')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('keeps the human signed label for cash differences', () => {
    render(
      <SessionSummary
        session={cashSessionFixture()}
        closingAmount="125.00"
        difference={25}
      />,
    );

    expect(screen.getByText('L +25.00')).toBeInTheDocument();
  });
});

function cashSessionFixture(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 1,
    user_id: 1,
    opening_amount: '100.00',
    closing_amount: null,
    expected_amount: '100.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-06-02T08:00:00Z',
    closed_at: null,
    payments_count: 0,
    payments_total: '0.00',
    payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
    expected_cash_amount: '100.00',
    pending_invoice_count: 0,
    pending_amount: '0.00',
    ...overrides,
  };
}
