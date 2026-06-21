import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashMovementsTable, type CashMovement } from './CashMovementsTable';

describe('CashMovementsTable', () => {
  it('shows payment movements as positive entries and payment voids as negative entries', () => {
    render(
      <CashMovementsTable
        movements={[
          movement({ id: 1, type: 'payment', method: 'cash', amount: '51.75' }),
          movement({ id: 2, type: 'payment_void', method: 'cash', amount: '17.25' }),
          movement({ id: 3, type: 'closing', method: 'closing', amount: '134.50' }),
        ]}
      />,
    );

    expect(rowFor('payment')).toHaveTextContent('+ L 51.75');
    expect(rowFor('payment_void')).toHaveTextContent('- L 17.25');
    expect(rowFor('closing')).toHaveTextContent('L 134.50');
    expect(rowFor('closing')).not.toHaveTextContent('- L 134.50');
  });
});

function rowFor(type: string): HTMLElement {
  return screen.getAllByText(type)[0]?.closest('tr') ?? (() => {
    throw new Error(`Missing row for ${type}`);
  })();
}

function movement(overrides: Partial<CashMovement>): CashMovement {
  return {
    id: 1,
    cash_session_id: 1,
    payment_id: null,
    user_id: 1,
    type: 'payment',
    method: null,
    amount: '0.00',
    notes: null,
    occurred_at: '2026-06-17T09:00:00-06:00',
    ...overrides,
  };
}
