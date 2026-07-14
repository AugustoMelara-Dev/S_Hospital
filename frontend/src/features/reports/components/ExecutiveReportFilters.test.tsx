import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExecutiveReportFilters } from './ExecutiveReportFilters';
import { PRESET_LABELS } from './reportDateRanges';

describe('ExecutiveReportFilters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('describes report refresh without implementation language', () => {
    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={vi.fn()}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
        onExportPdf={vi.fn()}
        onExportExcel={vi.fn()}
        canExport
        loading={false}
        exporting={false}
      />,
    );

    expect(screen.getByText(/actualice los indicadores/i)).toBeInTheDocument();
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument();
  });

  it('updates the date range when a quick period is selected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T12:00:00-06:00'));
    const onPresetChange = vi.fn();
    const onChange = vi.fn();

    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={onPresetChange}
        onChange={onChange}
        onRefresh={vi.fn()}
        onExportPdf={vi.fn()}
        onExportExcel={vi.fn()}
        canExport
        loading={false}
        exporting={false}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /periodo rápido/i }));
    fireEvent.click(screen.getByText(PRESET_LABELS.last7));

    expect(onPresetChange).toHaveBeenCalledWith('last7');
    expect(onChange).toHaveBeenCalledWith({
      date_from: '2026-06-27',
      date_to: '2026-07-03',
    });
  });

  it('does not render export actions without export permission', () => {
    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={vi.fn()}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
        onExportPdf={vi.fn()}
        onExportExcel={vi.fn()}
        canExport={false}
        loading={false}
        exporting={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /pdf ejecutivo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /excel ejecutivo/i })).not.toBeInTheDocument();
  });

  it('wraps the complete export action group on narrow viewports', () => {
    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={vi.fn()}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
        onExportPdf={vi.fn()}
        onExportExcel={vi.fn()}
        canExport
        loading={false}
        exporting={false}
      />,
    );

    const actionGroup = screen.getByRole('button', { name: /excel ejecutivo/i }).closest('.ant-space');
    expect(actionGroup).toHaveStyle({ flexWrap: 'wrap' });
  });

  it('describes the real 92 day limit and blocks stale-scope exports', () => {
    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={vi.fn()}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
        onExportPdf={vi.fn()}
        onExportExcel={vi.fn()}
        canExport
        loading={false}
        exporting={false}
        hasUnappliedChanges
      />,
    );

    expect(screen.getByText(/hasta 92 días/i)).toBeInTheDocument();
    expect(screen.getByText(/aplique el per.odo antes de exportar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pdf ejecutivo/i })).toBeDisabled();
  });
});
