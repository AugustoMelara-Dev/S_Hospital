import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrendChart } from './TrendChart';
import { buildExecutiveReport } from './testUtils';

vi.mock('recharts', async () => {
  const React = await import('react');

  return {
    Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
    AreaChart: ({ children, data }: { children: React.ReactNode; data: Array<Record<string, unknown>> }) => (
      <div data-testid="area-chart" data-chart={JSON.stringify(data)}>
        {children}
      </div>
    ),
    CartesianGrid: () => <div />,
    Legend: () => <div />,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tooltip: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
  };
});

describe('TrendChart', () => {
  it('normalizes malformed daily money values before rendering chart data', () => {
    render(
      <TrendChart
        report={buildExecutiveReport({
          daily_trend: [
            {
              date: '2026-06-01',
              billed: 'no-numero',
              collected: 'NaN',
              pending: '15.25',
              voided_count: 0,
              invoice_count: 1,
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('table', { name: /tendencia diaria del reporte ejecutivo/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('no-numero');
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).toContain('L 15.25');
    expect(screen.getByTestId('area-chart')).toHaveAttribute(
      'data-chart',
      JSON.stringify([
        {
          date: '2026-06-01',
          day: '06-01',
          Facturado: 0,
          Cobrado: 0,
          Pendiente: 15.25,
        },
      ]),
    );
  });
});
