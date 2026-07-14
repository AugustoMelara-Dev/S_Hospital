import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutiveReport } from '@/lib/api';
vi.mock('@/design-system/echarts', () => ({ formatHnl: (value: number) => `L ${value.toFixed(2)}`, InstitutionalChart: ({ ariaLabel, alternativeTable, option, state }: { ariaLabel: string; alternativeTable: React.ReactNode; option: unknown; state: string }) => <figure aria-label={ariaLabel} data-state={state} data-option={JSON.stringify(option)}>{alternativeTable}</figure> }));
vi.mock('@/design-system/ag-grid', () => ({ InstitutionalDataGrid: ({ ariaLabel, rows, state }: { ariaLabel: string; rows: unknown[]; state: string }) => <section aria-label={ariaLabel} data-state={state}>{rows.length} filas</section> }));
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { buildExecutiveReport } from './testUtils';

describe('PaymentMethodPanel', () => {
  it('provides ECharts, a grid and an exact alternative table', () => {
    render(<PaymentMethodPanel report={buildExecutiveReport({ summary: { ...buildExecutiveReport().summary, collected_total_cents: 1725, collected_total: '17.25' }, payment_methods: [{ method: 'cash', label: 'Efectivo', amount: '17.25', count: 2, percentage: 100 }] })} />);
    expect(screen.getByLabelText(/participación por método/i)).toHaveAttribute('data-option', expect.stringContaining('bar'));
    expect(screen.getByLabelText(/métodos de pago/i)).toHaveTextContent('2 filas');
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
    expect(screen.getByLabelText(/participación por método/i)).toHaveAttribute('data-state', 'empty');
    expect(screen.getByLabelText(/métodos de pago/i)).toHaveAttribute('data-state', 'empty');
  });
});
