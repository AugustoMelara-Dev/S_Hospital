import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceSalesTab } from './ServiceSalesTab';

describe('ServiceSalesTab', () => {
  it('renders malformed service and category amounts as safe financial values', () => {
    render(
      <ServiceSalesTab
        canExport={false}
        dateFrom="2026-05-01"
        dateTo="2026-05-31"
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
              quantity: 'cantidad-danada',
              subtotal: 'monto-danado',
              tax_amount: 'NaN',
              total: 'no-numero',
            },
          ],
        }}
        serviceSales={{
          date_from: '2026-05-01',
          date_to: '2026-05-31',
          amount_basis: 'collected_prorated',
          amount_label: 'Cobrado asignado proporcionalmente',
          amount_source: 'Pagos publicados filtrados',
          filters: { date_from: '2026-05-01', date_to: '2026-05-31' },
          services: [
            {
              service: 'Glucosa',
              category: 'Laboratorio',
              item_count: 1,
              quantity: 'cantidad-danada',
              total: 'monto-danado',
            },
          ],
        }}
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).toContain('Cobrado asignado proporcionalmente');
    expect(document.body.textContent).toContain('Pagos publicados filtrados');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|cantidad-danada|undefined/);
  });
});
