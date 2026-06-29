import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DailyReport } from '../../../lib/api/types';
import { DailyReportTab } from './DailyReportTab';

describe('DailyReportTab', () => {
  it('renders daily financial sections with shared accessible tables', () => {
    render(
      <DailyReportTab
        canExport={false}
        daily={buildDailyReport()}
        dailyDate="2026-06-02"
        error=""
        loading={false}
        onDateChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByRole('region', { name: /lectura financiera/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /lectura financiera diaria/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /cobros por método/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /cobros diarios por método/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /estado de facturas/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /estado diario de facturas/i })).toBeInTheDocument();
    expect(screen.getByText('Pagos registrados')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Pagada')).toBeInTheDocument();
  });
});

function buildDailyReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    date: '2026-06-02',
    total_billed: '150.00',
    total_collected: '75.00',
    total_pending: '50.00',
    total_partial: '25.00',
    total_voided: '0.00',
    invoice_count: 3,
    payment_count: 2,
    payments_by_method: {
      cash: '75.00',
      transfer: '0.00',
      card: '0.00',
      other: '0.00',
    },
    invoices_by_status: {
      issued: { count: 1, total: '50.00' },
      partial: { count: 1, total: '25.00' },
      paid: { count: 1, total: '75.00' },
      void: { count: 0, total: '0.00' },
    },
    ...overrides,
  };
}
