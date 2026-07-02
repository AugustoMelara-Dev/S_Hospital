import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportFiltersPanel } from './ReportFiltersPanel';

describe('ReportFiltersPanel', () => {
  it('describes report refresh without implementation language', () => {
    render(
      <ReportFiltersPanel
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
});
