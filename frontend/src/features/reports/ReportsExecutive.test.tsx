import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsExecutive } from './ReportsExecutive';
import { buildExecutiveReport } from './components/testUtils';

const useExecutiveReportMock = vi.hoisted(() => vi.fn());
const downloadExecutivePdf = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useExecutiveReport', () => ({
  useExecutiveReport: useExecutiveReportMock,
}));

vi.mock('@/components/ui/toaster', () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/download', () => ({
  downloadBlob: vi.fn(),
  openBlobInNewTab: vi.fn(),
}));

vi.mock('./components/ExecutiveSummary', () => ({
  ExecutiveSummary: () => <div data-testid="executive-summary" />,
}));

vi.mock('./components/ExecutiveAlerts', () => ({
  ExecutiveAlerts: () => <div data-testid="executive-alerts" />,
}));

vi.mock('./components/PaymentMethodPanel', () => ({
  PaymentMethodPanel: () => <div data-testid="payment-method-panel" />,
}));

vi.mock('./components/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
}));

vi.mock('./components/ServiceRanking', () => ({
  ServiceRanking: () => <div data-testid="service-ranking" />,
}));

vi.mock('./components/PendingAgingPanel', () => ({
  PendingAgingPanel: () => <div data-testid="pending-aging-panel" />,
}));

vi.mock('./components/AuditSummaryPanel', () => ({
  AuditSummaryPanel: () => <div data-testid="audit-summary-panel" />,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      downloadExecutivePdf,
    },
  };
});

describe('ReportsExecutive', () => {
  beforeEach(() => {
    useExecutiveReportMock.mockReset();
    useExecutiveReportMock.mockReturnValue({
      data: buildExecutiveReport(),
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    });
    downloadExecutivePdf.mockReset();
  });

  it('keeps executive free of cash and audit detail panels', () => {
    render(
      <ReportsExecutive
        canExport
        canViewManagerial
        onStatus={vi.fn()}
      />,
    );

    const panelIds = [
      'executive-summary',
      'executive-alerts',
      'pending-aging-panel',
      'payment-method-panel',
      'trend-chart',
      'service-ranking',
    ];
    const panels = panelIds.map((id) => screen.getByTestId(id));

    panels.forEach((panel) => expect(panel).toBeInTheDocument());
    panels.slice(1).forEach((panel, index) => {
      expect(panels[index].compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.queryByTestId('cash-reconciliation-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('voids-reversals-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audit-summary-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /definicion de metricas/i })).not.toBeInTheDocument();
  });

  it('shows a LAN-safe error message when the executive report fails without detail', () => {
    useExecutiveReportMock.mockReturnValue({
      data: null,
      isFetching: false,
      isError: true,
      refetch: vi.fn(),
      error: null,
    });

    render(
      <ReportsExecutive
        canExport
        canViewManagerial
        onStatus={vi.fn()}
      />,
    );

    expect(screen.getByText(/revise la conexion local/i)).toBeInTheDocument();
    expect(screen.queryByText(/error desconocido/i)).not.toBeInTheDocument();
  });

  it('shows export progress while an executive PDF is being prepared', async () => {
    downloadExecutivePdf.mockReturnValue(new Promise(() => undefined));

    render(
      <ReportsExecutive
        canExport
        canViewManagerial
        onStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /pdf ejecutivo/i }));

    await waitFor(() => expect(downloadExecutivePdf).toHaveBeenCalledTimes(1));
    const exportingButtons = screen.getAllByRole('button', { name: /exportando/i });
    expect(exportingButtons.length).toBeGreaterThan(0);
    exportingButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByRole('button', { name: /refrescar ejecutivo/i })).toBeDisabled();
    expect(screen.getByLabelText(/periodo rapido/i)).toBeDisabled();
    expect(screen.getByLabelText(/inicio ejecutivo/i)).toBeDisabled();
    expect(screen.getByLabelText(/fin ejecutivo/i)).toBeDisabled();
  });
});
