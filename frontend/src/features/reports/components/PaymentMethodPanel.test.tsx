import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ExecutiveReport } from '@/lib/api';
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { buildExecutiveReport } from './testUtils';

describe('PaymentMethodPanel', () => {
  it('provides Recharts, a TanStack table and an exact HTML alternative', () => {
    render(<PaymentMethodPanel report={buildExecutiveReport({ summary: { ...buildExecutiveReport().summary, collected_total_cents: 1725, collected_total: '17.25' }, payment_methods: [{ method: 'cash', label: 'Efectivo', amount: '17.25', count: 2, percentage: 100 }] })} />);
    expect(screen.getByRole('img', { name: /participación por método/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /métodos de pago/i })).toHaveTextContent('Efectivo');
    expect(screen.getByRole('table', { name: /recaudación por método/i })).toHaveTextContent('L 17.25');
  });
  it('normalizes malformed percentages and counts without NaN', () => {
    const malformed = { method: 'transfer', label: 'Transferencia', amount: '25.00', count: 'bad', percentage: 'NaN' } as unknown as ExecutiveReport['payment_methods'][number];
    render(<PaymentMethodPanel report={buildExecutiveReport({ payment_methods: [malformed] })} />);
    expect(document.body).toHaveTextContent('0.00%');
    expect(document.body).not.toHaveTextContent(/NaN|bad/);
  });
  it('exposes explicit empty states', () => {
    render(<PaymentMethodPanel report={buildExecutiveReport({ payment_methods: [] })} />);
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText(/sin métodos de pago/i)).toBeInTheDocument();
  });
});
