import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { theme } from 'antd';

import './institutional-chart.css';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer]);

export type ChartState = 'ready' | 'loading' | 'empty' | 'error';
export type ChartColorMode = 'light' | 'dark';

export const formatHnl = (value: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(value);
export const formatInstitutionalDate = (value: string | number | Date) => new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium' }).format(new Date(value));

export function createInstitutionalChartOption({ option, colors, textColor, reducedMotion = false }: {
  option: EChartsCoreOption;
  colors: string[];
  textColor: string;
  reducedMotion?: boolean;
}): EChartsCoreOption {
  return {
    animation: !reducedMotion,
    backgroundColor: 'transparent',
    color: colors,
    textStyle: { color: textColor, fontFamily: 'IBM Plex Sans Variable, system-ui, sans-serif' },
    aria: { show: true },
    ...option,
  };
}

export interface InstitutionalChartProps {
  ariaLabel: string;
  option: EChartsCoreOption;
  mode?: ChartColorMode;
  state?: ChartState;
  errorMessage?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  summary?: ReactNode;
  alternativeTable?: ReactNode;
  height?: number | string;
  renderer?: 'canvas';
}

export function InstitutionalChart({
  ariaLabel,
  option,
  mode = 'light',
  state = 'ready',
  errorMessage = 'No se pudo cargar el gráfico.',
  emptyMessage = 'No hay datos para mostrar.',
  loadingMessage = 'Cargando gráfico…',
  summary,
  alternativeTable,
  renderer = 'canvas',
}: InstitutionalChartProps) {
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const colors = useMemo(() => [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorInfo,
  ], [token.colorError, token.colorInfo, token.colorPrimary, token.colorSuccess, token.colorWarning]);
  const resolvedOption = useMemo(
    () => createInstitutionalChartOption({ option, colors, textColor: token.colorText, reducedMotion }),
    [colors, option, reducedMotion, token.colorText],
  );

  useEffect(() => {
    if (state !== 'ready' || !containerRef.current) return;
    const instance = echarts.init(containerRef.current, undefined, { renderer });
    chartRef.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chartRef.current = null;
    };
  }, [renderer, state]);

  useEffect(() => {
    chartRef.current?.setOption(resolvedOption, { notMerge: true });
  }, [resolvedOption]);

  return (
    <figure className={`institutional-chart institutional-chart--${mode}`} aria-label={ariaLabel}>
      {state !== 'ready' ? (
        <div className="institutional-chart__state" role={state === 'error' ? 'alert' : 'status'}>
          {state === 'loading' ? loadingMessage : state === 'error' ? errorMessage : emptyMessage}
        </div>
      ) : (
        <div ref={containerRef} className="institutional-chart__canvas" role="img" aria-label={ariaLabel} />
      )}
      {summary ? <figcaption className="institutional-chart__summary">{summary}</figcaption> : null}
      {alternativeTable ? (
        <div
          className="institutional-chart__table"
          role="region"
          aria-label={`Datos tabulares de ${ariaLabel}`}
          tabIndex={0}
        >
          {alternativeTable}
        </div>
      ) : null}
    </figure>
  );
}
