import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsCash } from './ReportsCash';
import type { CashSessionReport } from '@/lib/api/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getCashSessions: vi.fn(),
      getCashSessionReport: vi.fn(),
      downloadReportExport: vi.fn(),
    },
  };
});

vi.mock('@/lib/download', () => ({
  downloadBlob: vi.fn(),
}));

const { apiClient } = await import('@/lib/api');
const { downloadBlob } = await import('@/lib/download');

describe('ReportsCash', () => {
  beforeEach(() => {
    vi.mocked(apiClient.getCashSessionReport).mockReset();
    vi.mocked(apiClient.getCashSessions).mockReset();
    vi.mocked(apiClient.getCashSessions).mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 5, total: 0 },
    });
    vi.mocked(apiClient.downloadReportExport).mockReset();
    vi.mocked(downloadBlob).mockReset();
  });

  it('lets the cashier open a recent cash session report without typing an id', async () => {
    vi.mocked(apiClient.getCashSessions).mockResolvedValue({
      data: [buildCashSessionReport().cash_session],
      meta: { current_page: 1, per_page: 5, total: 1 },
    });
    vi.mocked(apiClient.getCashSessionReport).mockResolvedValue(buildCashSessionReport());

    render(<ReportsCash canViewCash canViewManagerial={false} />);

    const recentCashSelect = await screen.findByLabelText(/caja reciente/i);
    expect(recentCashSelect).toHaveValue('12');
    expect(screen.queryByText(/ingrese el numero de caja/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    await waitFor(() => {
      expect(apiClient.getCashSessionReport).toHaveBeenCalledWith('12');
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Caja Principal/i).length).toBeGreaterThan(0);
    });
  });

  it('shows a loading state while cash session report is loading', async () => {
    vi.mocked(apiClient.getCashSessionReport).mockReturnValue(new Promise(() => undefined));

    render(<ReportsCash canViewCash canViewManagerial={false} />);

    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/numero de caja/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    expect(apiClient.getCashSessionReport).toHaveBeenCalledWith('12');
    expect(screen.getByRole('button', { name: /consultando/i })).toBeDisabled();
  });

  it('blocks invalid cash session numbers before requesting the report', async () => {
    render(<ReportsCash canViewCash canViewManagerial={false} />);

    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/numero de caja/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    expect(apiClient.getCashSessionReport).not.toHaveBeenCalled();
    expect(screen.getByText(/ingrese un numero de caja valido/i)).toBeInTheDocument();
  });

  it('exports the loaded cash session report with the selected cash box id', async () => {
    vi.mocked(apiClient.getCashSessionReport).mockResolvedValue(buildCashSessionReport());
    vi.mocked(apiClient.downloadReportExport).mockResolvedValue(new Blob(['xlsx'], { type: 'application/vnd.ms-excel' }));

    render(<ReportsCash canViewCash canViewManagerial />);

    fireEvent.change(screen.getByLabelText(/numero de caja/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    const exportButton = await screen.findByRole('button', { name: /exportar excel/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(apiClient.downloadReportExport).toHaveBeenCalledWith(expect.objectContaining({
        date_from: '2026-06-02',
        date_to: '2026-06-02',
        cash_session_id: 12,
      }));
    });
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'reporte-caja-12.xlsx');
  });

  it('locks the cash session lookup while exporting the loaded report', async () => {
    vi.mocked(apiClient.getCashSessionReport).mockResolvedValue(buildCashSessionReport());
    vi.mocked(apiClient.downloadReportExport).mockReturnValue(new Promise(() => undefined));

    render(<ReportsCash canViewCash canViewManagerial />);

    fireEvent.change(screen.getByLabelText(/numero de caja/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    const exportButton = await screen.findByRole('button', { name: /exportar excel/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(apiClient.downloadReportExport).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText(/numero de caja/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /ver caja/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /exportando/i })).toBeDisabled();
  });
});

function buildCashSessionReport(): CashSessionReport {
  return {
    cash_session: {
      id: 12,
      user_id: 7,
      status: 'closed',
      opening_amount: '500.00',
      closing_amount: '517.25',
      expected_amount: '517.25',
      difference_amount: '0.00',
      opening_notes: null,
      closing_notes: null,
      opened_at: '2026-06-02T08:00:00.000000Z',
      closed_at: '2026-06-02T16:00:00.000000Z',
      user: { id: 7, name: 'Caja Principal', username: 'caja' },
    },
    totals_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
    total_cash: '17.25',
    total_transfer: '0.00',
    total_card: '0.00',
    total_other: '0.00',
    payments_count: 1,
    payments_total: '17.25',
    expected_cash_amount: '517.25',
    pending_invoice_count: 0,
    pending_amount: '0.00',
    payments: [],
    movements: [],
  };
}
