import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { buildExecutiveReport } from './testUtils';
import type { ExecutiveReport } from '@/lib/api';

describe('PaymentMethodPanel', () => {
  it('renders payment methods inside the shared accessible table container', () => {
    render(
      <PaymentMethodPanel
        report={buildExecutiveReport({
          summary: {
            ...buildExecutiveReport().summary,
            collected_total_cents: 1725,
            collected_total: '17.25',
          },
          payment_methods: [
            {
              method: 'cash',
              label: 'Efectivo',
              amount: '17.25',
              count: 2,
              percentage: 100,
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('region', { name: /metodos de pago/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /recaudacion por metodo de pago/i })).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 17.25');
    expect(screen.getAllByText('100.00%').length).toBeGreaterThan(0);
  });

  it('uses the shared empty state when no payment methods exist', () => {
    render(<PaymentMethodPanel report={buildExecutiveReport({ payment_methods: [] })} />);

    expect(screen.getByText(/sin metodos de pago/i)).toBeInTheDocument();
    expect(screen.getByText(/los cobros por metodo apareceran/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('normalizes malformed payment method percentages and counts', () => {
    const malformedMethod = {
      method: 'transfer',
      label: 'Transferencia',
      amount: '25.00',
      count: 'no-numero',
      percentage: 'NaN',
    } as unknown as ExecutiveReport['payment_methods'][number];

    render(
      <PaymentMethodPanel
        report={buildExecutiveReport({
          payment_methods: [malformedMethod],
        })}
      />,
    );

    expect(screen.getByText('Transferencia - 0.00%')).toBeInTheDocument();
    expect(screen.getByText('0 pagos')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('no-numero');
  });
});
