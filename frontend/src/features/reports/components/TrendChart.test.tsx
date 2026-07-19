import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ExecutiveReport } from '@/lib/api';
import { TrendChart } from './TrendChart';

describe('TrendChart', () => {
  it('provides a Recharts visualization, summary and an exact alternative table', () => {
    const report = fixture([{ date: '2026-07-12', billed: '100.00', collected: '75.00', pending: '25.00' }]);
    render(<TrendChart report={report} />);
    expect(screen.getByRole('img', { name: /gráfico de tendencia/i })).toBeInTheDocument();
    expect(screen.getByText(/1 día con actividad/i)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /tendencia diaria/i })).toHaveTextContent('L 100.00');
  });
  it('normalizes malformed money and dates safely', () => {
    render(<TrendChart report={fixture([{ date: 'bad', billed: 'bad', collected: 'bad', pending: 'bad' }])} />);
    expect(screen.getByText('Fecha no disponible')).toBeInTheDocument();
    expect(screen.getAllByText('L 0.00')).toHaveLength(3);
  });
});

function fixture(rows: Array<{ date: string; billed: string; collected: string; pending: string }>): ExecutiveReport { const daily_trend = rows.map((row) => ({ ...row, voided_count: 0, invoice_count: 1 })); return { daily_trend, payment_methods: [], summary: { collected_total_cents: 0 } } as unknown as ExecutiveReport; }
