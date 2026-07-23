import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByRole('button', { name: /^aplicar$/i })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('combobox', { name: /periodo rápido/i }));
    fireEvent.click(screen.getByRole('option', { name: PRESET_LABELS.last7 }));

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

    expect(screen.queryByRole('button', { name: /^exportar$/i })).not.toBeInTheDocument();
  });

  it('keeps PDF and Excel in one export menu', async () => {
    const user = userEvent.setup();
    const onExportPdf = vi.fn();
    const onExportExcel = vi.fn();
    render(
      <ExecutiveReportFilters
        filters={{ date_from: '2026-07-01', date_to: '2026-07-02' }}
        preset="custom"
        onPresetChange={vi.fn()}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        canExport
        loading={false}
        exporting={false}
      />,
    );

    expect(screen.getAllByRole('button', { name: /^exportar$/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /pdf ejecutivo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /excel ejecutivo/i })).not.toBeInTheDocument();

    screen.getByRole('button', { name: /^exportar$/i }).focus();
    await user.click(screen.getByRole('button', { name: /^exportar$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /documento pdf/i }));
    expect(onExportPdf).toHaveBeenCalledOnce();

    screen.getByRole('button', { name: /^exportar$/i }).focus();
    await user.click(screen.getByRole('button', { name: /^exportar$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /libro de excel/i }));
    expect(onExportExcel).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('button', { name: /^exportar$/i })).toBeDisabled();
  });
});
