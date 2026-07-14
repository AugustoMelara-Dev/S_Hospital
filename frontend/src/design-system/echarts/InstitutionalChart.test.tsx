import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chart, init, use } = vi.hoisted(() => {
  const chartInstance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), showLoading: vi.fn(), hideLoading: vi.fn() };
  return { chart: chartInstance, init: vi.fn(() => chartInstance), use: vi.fn() };
});

vi.mock('echarts/core', () => ({ init, use }));
vi.mock('echarts/charts', () => ({ BarChart: {}, LineChart: {}, PieChart: {} }));
vi.mock('echarts/components', () => ({ AriaComponent: {}, GridComponent: {}, LegendComponent: {}, TooltipComponent: {} }));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));

import { InstitutionalChart, createInstitutionalChartOption, formatHnl, formatInstitutionalDate } from './InstitutionalChart';

describe('InstitutionalChart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enforces aria, institutional animation and formatter defaults', () => {
    const option = createInstitutionalChartOption({
      reducedMotion: true,
      colors: ['token-primary', 'token-success'],
      textColor: 'token-text',
      option: { series: [{ type: 'bar', data: [10, 20] }] },
    });
    expect(option.aria).toMatchObject({ show: true });
    expect(option.animation).toBe(false);
    expect(option.color).toEqual(['token-primary', 'token-success']);
    expect(option.textStyle).toMatchObject({ color: 'token-text' });
    expect(formatHnl(2500)).toContain('L');
    expect(formatInstitutionalDate('2026-07-12')).toContain('2026');
  });

  it('initializes, observes size, updates options and disposes', () => {
    const { rerender, unmount } = render(<InstitutionalChart ariaLabel="Ingresos" option={{ series: [{ type: 'line', data: [1] }] }} summary="Ingresos diarios" />);
    expect(init).toHaveBeenCalledOnce();
    expect(chart.setOption).toHaveBeenCalled();
    expect(screen.getByText('Ingresos diarios')).toBeInTheDocument();
    rerender(<InstitutionalChart ariaLabel="Ingresos" option={{ series: [{ type: 'line', data: [2] }] }} summary="Ingresos diarios" />);
    expect(chart.setOption).toHaveBeenCalledTimes(2);
    unmount();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it.each(['loading', 'empty', 'error'] as const)('renders %s without initializing a chart', (state) => {
    render(<InstitutionalChart ariaLabel="Ingresos" option={{}} state={state} errorMessage="No se pudo cargar" />);
    expect(screen.getByRole(state === 'error' ? 'alert' : 'status')).toBeInTheDocument();
    expect(init).not.toHaveBeenCalled();
  });

  it('renders an accepted alternative table', () => {
    render(<InstitutionalChart ariaLabel="Ingresos" option={{}} summary="Resumen" alternativeTable={<table aria-label="Datos"><tbody><tr><td>Julio</td></tr></tbody></table>} />);
    expect(screen.getByRole('table', { name: 'Datos' })).toBeInTheDocument();
  });
});
