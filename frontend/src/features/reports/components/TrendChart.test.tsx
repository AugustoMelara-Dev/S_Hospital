import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrendChart } from './TrendChart';
import { buildExecutiveReport } from './testUtils';

vi.mock('recharts', async () => {
  const React = await import('react');

  return {
    Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
    AreaChart: ({ children, data }: { children: React.ReactNode; data: Array<Record<string, unknown>> }) => (
      <svg data-testid="area-chart" data-chart={JSON.stringify(data)}>
        {children}
      </svg>
    ),
    CartesianGrid: () => <div />,
    Legend: () => <div />,
    ResponsiveContainer: ({
      children,
      height,
      minWidth,
    }: {
      children: React.ReactNode;
      height?: number | string;
      minWidth?: number;
    }) => (
      <div data-testid="responsive-chart" data-height={height} data-min-width={minWidth}>
        {children}
      </div>
    ),
    Tooltip: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
  };
});

describe('TrendChart', () => {
  it('shows a visible text summary and exact data table beside the chart', () => {
    render(
      <TrendChart
        report={buildExecutiveReport({
          daily_trend: [
            {
              date: '2026-07-01',
              billed: '125.00',
              collected: '100.00',
              pending: '25.00',
              voided_count: 0,
              invoice_count: 2,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText(/1 dia con actividad/i)).toBeVisible();
    const table = screen.getByRole('table', { name: /tendencia diaria del reporte ejecutivo/i });
    expect(table).toBeVisible();
    expect(table).toHaveTextContent('L 125.00');
    expect(table).toHaveTextContent('L 100.00');
    expect(table).toHaveTextContent('L 25.00');
  });

  it('gives Recharts a stable measurable height and non-negative minimum width', () => {
    render(<TrendChart report={buildExecutiveReport()} />);

    expect(screen.getByTestId('responsive-chart')).toHaveAttribute('data-height', '320');
    expect(screen.getByTestId('responsive-chart')).toHaveAttribute('data-min-width', '0');
  });

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

  it('uses a human fallback for malformed trend dates', () => {
    render(
      <TrendChart
        report={buildExecutiveReport({
          daily_trend: [
            {
              date: 'fecha-danada',
              billed: '100.00',
              collected: '90.00',
              pending: '10.00',
              voided_count: 0,
              invoice_count: 1,
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('table', { name: /tendencia diaria del reporte ejecutivo/i })).toBeInTheDocument();
    expect(document.body.textContent).toContain('Fecha no disponible');
    expect(document.body.textContent).not.toContain('fecha-danada');
    expect(screen.getByTestId('area-chart')).toHaveAttribute(
      'data-chart',
      JSON.stringify([
        {
          date: 'Fecha no disponible',
          day: 'Fecha no disponible',
          Facturado: 100,
          Cobrado: 90,
          Pendiente: 10,
        },
      ]),
    );
  });
});
