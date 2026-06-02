import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashSessionReportTab } from './CashSessionReportTab';
import type { CashSessionReport } from '../../../lib/api/types';

describe('CashSessionReportTab', () => {
  it('renders malformed cash session amounts as safe financial values', () => {
    const cashSession = {
      cash_session: {
        id: 1,
        user_id: 7,
        status: 'closed',
        opening_amount: 'monto-danado',
        closing_amount: 'NaN',
        expected_amount: 'no-numero',
        difference_amount: '1.25',
        opening_notes: null,
        closing_notes: null,
        opened_at: '2026-05-31T08:00:00.000000Z',
        closed_at: '2026-05-31T16:00:00.000000Z',
        user: { id: 7, name: 'Caja Principal', username: 'caja' },
      },
      totals_by_method: { cash: 'monto-danado', transfer: '', card: 'NaN', other: 'no-numero' },
      total_cash: 'monto-danado',
      total_transfer: '',
      total_card: 'NaN',
      total_other: 'no-numero',
      payments_count: 1,
      payments_total: 'monto-danado',
      expected_cash_amount: 'no-numero',
      pending_invoice_count: 1,
      pending_amount: 'NaN',
      payments: [
        {
          id: 10,
          invoice_id: 12,
          cash_session_id: 1,
          user_id: 7,
          method: 'cash',
          amount: 'monto-danado',
          status: 'posted',
          reference: null,
          paid_at: '2026-05-31T12:00:00.000000Z',
          invoice: {
            id: 12,
            invoice_number: 'F-000012',
            patient_name: 'Paciente Prueba',
            status: 'partial',
            total: 'monto-danado',
            paid_amount: 'NaN',
            balance_due: 'no-numero',
          },
        },
      ],
      movements: [
        {
          id: 20,
          cash_session_id: 1,
          payment_id: null,
          user_id: 7,
          type: 'adjustment',
          method: 'cash',
          amount: 'no-numero',
          notes: null,
          occurred_at: '2026-05-31T13:00:00.000000Z',
          user: { id: 7, name: 'Caja Principal', username: 'caja' },
        },
      ],
    } satisfies CashSessionReport;

    render(
      <CashSessionReportTab
        canExport={false}
        cashSession={cashSession}
        cashReportId="1"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('L. 1.25');
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });
});
