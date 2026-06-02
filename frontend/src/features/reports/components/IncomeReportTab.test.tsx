import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IncomeReportTab } from './IncomeReportTab';

describe('IncomeReportTab', () => {
  it('renders malformed range report amounts as zero instead of raw values', () => {
    render(
      <IncomeReportTab
        canExport={false}
        dateFrom="2026-05-01"
        dateTo="2026-05-31"
        categoryId=""
        areaId=""
        cashSessionId=""
        cashierId=""
        method=""
        status=""
        categoryOptions={[]}
        areaOptions={[]}
        cashSessionOptions={[]}
        loading={false}
        income={{
          date_from: '2026-05-01',
          date_to: '2026-05-31',
          cash_session_id: null,
          user_id: null,
          filters: { date_from: '2026-05-01', date_to: '2026-05-31' },
          total_billed: 'monto-danado',
          total_collected: 'NaN',
          total_pending: 'no-numero',
          total_partial: '',
          total_voided: 'monto-danado',
          payments_by_method: { cash: 'monto-danado', transfer: '', card: 'NaN', other: 'no-numero' },
          payment_count: 1,
          invoice_count: 1,
        }}
        categories={{
          date_from: '2026-05-01',
          date_to: '2026-05-31',
          amount_basis: 'collected_prorated',
          amount_label: 'Cobrado asignado proporcionalmente',
          amount_source: 'Pagos publicados filtrados',
          filters: { date_from: '2026-05-01', date_to: '2026-05-31' },
          categories: [
            {
              category: 'Laboratorio',
              item_count: 1,
              quantity: '1.00',
              subtotal: 'monto-danado',
              tax_amount: 'NaN',
              total: 'no-numero',
            },
          ],
        }}
        areas={{
          date_from: '2026-05-01',
          date_to: '2026-05-31',
          amount_basis: 'collected_prorated',
          amount_label: 'Cobrado asignado proporcionalmente',
          amount_source: 'Pagos publicados filtrados',
          filters: { date_from: '2026-05-01', date_to: '2026-05-31' },
          areas: [{ area_id: 1, area: 'Laboratorio', item_count: 1, quantity: '1.00', total: 'monto-danado' }],
        }}
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onCategoryChange={() => undefined}
        onAreaChange={() => undefined}
        onCashSessionChange={() => undefined}
        onCashierChange={() => undefined}
        onMethodChange={() => undefined}
        onStatusChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).toContain('Cobrado asignado proporcionalmente');
    expect(document.body.textContent).toContain('Pagos publicados filtrados');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
    expect(screen.getAllByText('Laboratorio').length).toBeGreaterThan(0);
  });
});
