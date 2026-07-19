import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ReportsExecutive } from './ReportsExecutive';
import { buildExecutiveReport } from './components/testUtils';

const useExecutiveReportMock = vi.hoisted(() => vi.fn());
const downloadExecutivePdf = vi.hoisted(() => vi.fn());
const downloadExecutiveExcel = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useExecutiveReport', () => ({
  useExecutiveReport: useExecutiveReportMock,
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
      downloadExecutiveExcel,
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
    downloadExecutiveExcel.mockReset();
  });

  function renderExecutive(
    props: Partial<React.ComponentProps<typeof ReportsExecutive>> = {},
    initialEntry = '/reports/executive',
  ) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ReportsExecutive
          canExport
          canViewManagerial
          onStatus={vi.fn()}
          {...props}
        />
      </MemoryRouter>,
    );
  }

  function HistoryControls() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output aria-label="url actual">{location.pathname}{location.search}</output>
        <button type="button" onClick={() => navigate(-1)}>Volver período</button>
      </>
    );
  }

  it('restores the applied period when browser history changes', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/reports/executive?from=2026-06-01&to=2026-06-02',
          '/reports/executive?from=2026-07-01&to=2026-07-10',
        ]}
        initialIndex={1}
      >
        <ReportsExecutive canExport canViewManagerial onStatus={vi.fn()} />
        <HistoryControls />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /volver per.odo/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/inicio ejecutivo/i)).toHaveValue('2026-06-01');
      expect(screen.getByLabelText(/fin ejecutivo/i)).toHaveValue('2026-06-02');
      expect(useExecutiveReportMock).toHaveBeenLastCalledWith(
        { date_from: '2026-06-01', date_to: '2026-06-02' },
        true,
      );
    });
  });

  it('creates navigable history when periods are applied from the UI', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/executive?from=2026-07-01&to=2026-07-10']}>
        <ReportsExecutive canExport canViewManagerial onStatus={vi.fn()} />
        <HistoryControls />
      </MemoryRouter>,
    );

    await selectDate(/fin ejecutivo/i, '2026-07-11');
    fireEvent.click(screen.getByRole('button', { name: /refrescar ejecutivo/i }));
    await waitFor(() => expect(screen.getByLabelText(/url actual/i)).toHaveTextContent('to=2026-07-11'));

    await selectDate(/fin ejecutivo/i, '2026-07-12');
    fireEvent.click(screen.getByRole('button', { name: /refrescar ejecutivo/i }));
    await waitFor(() => expect(screen.getByLabelText(/url actual/i)).toHaveTextContent('to=2026-07-12'));

    fireEvent.click(screen.getByRole('button', { name: /volver per.odo/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/fin ejecutivo/i)).toHaveValue('2026-07-11');
      expect(useExecutiveReportMock).toHaveBeenLastCalledWith(
        { date_from: '2026-07-01', date_to: '2026-07-11' },
        true,
      );
    });
  });

  it('blocks exports while edited dates have not been applied', async () => {
    renderExecutive({}, '/reports/executive?from=2026-07-01&to=2026-07-10');

    await selectDate(/fin ejecutivo/i, '2026-07-11');

    expect(screen.getByRole('button', { name: /pdf ejecutivo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /excel ejecutivo/i })).toBeDisabled();
    expect(screen.getByText(/aplique el per.odo antes de exportar/i)).toBeInTheDocument();
    expect(downloadExecutivePdf).not.toHaveBeenCalled();
  });

  it('uses a valid URL period for the query, visible scope and export', async () => {
    downloadExecutivePdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));

    renderExecutive({}, '/reports/executive?from=2026-07-01&to=2026-07-10');

    expect(useExecutiveReportMock).toHaveBeenLastCalledWith(
      { date_from: '2026-07-01', date_to: '2026-07-10' },
      true,
    );
    expect(screen.getByRole('region', { name: /alcance del reporte ejecutivo/i })).toHaveTextContent(
      /1 de julio de 2026.*10 de julio de 2026/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /pdf ejecutivo/i }));

    await waitFor(() => {
      expect(downloadExecutivePdf).toHaveBeenCalledWith({
        date_from: '2026-07-01',
        date_to: '2026-07-10',
      });
    });
  });

  it('does not query or export an invalid URL period', () => {
    renderExecutive({}, '/reports/executive?from=2026-07-10&to=2026-07-01');

    expect(useExecutiveReportMock).toHaveBeenLastCalledWith(
      { date_from: '2026-07-10', date_to: '2026-07-01' },
      false,
    );
    expect(screen.getAllByText(/fecha de inicio debe ser anterior o igual/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /pdf ejecutivo/i })).toBeDisabled();
    expect(downloadExecutivePdf).not.toHaveBeenCalled();
  });

  it('rejects calendar dates that do not exist before querying', () => {
    renderExecutive({}, '/reports/executive?from=2026-02-31&to=2026-03-02');

    expect(useExecutiveReportMock).toHaveBeenLastCalledWith(
      { date_from: '2026-02-31', date_to: '2026-03-02' },
      false,
    );
    expect(screen.getAllByText(/seleccione fechas validas/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: /alcance del reporte ejecutivo/i })).not.toBeInTheDocument();
  });

  it('keeps executive free of cash and audit detail panels', () => {
    renderExecutive();

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
    const refetch = vi.fn();
    useExecutiveReportMock.mockReturnValue({
      data: null,
      isFetching: false,
      isError: true,
      refetch,
      error: null,
    });

    renderExecutive();

    expect(screen.getByText(/revise la conexi.n local/i)).toBeInTheDocument();
    expect(screen.queryByText(/error desconocido/i)).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /reintentar/i });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows export progress while an executive PDF is being prepared', async () => {
    downloadExecutivePdf.mockReturnValue(new Promise(() => undefined));
    const onStatus = vi.fn();

    renderExecutive({ onStatus });

    fireEvent.click(screen.getByRole('button', { name: /pdf ejecutivo/i }));

    await waitFor(() => expect(downloadExecutivePdf).toHaveBeenCalledTimes(1));
    const exportingButtons = screen.getAllByRole('button', { name: /exportando/i });
    expect(exportingButtons.length).toBeGreaterThan(0);
    exportingButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByRole('button', { name: /refrescar ejecutivo/i })).toBeDisabled();
    expect(screen.getByLabelText(/per[ií]odo r[aá]pido/i)).toBeDisabled();
    expect(screen.getByLabelText(/inicio ejecutivo/i)).toBeDisabled();
    expect(screen.getByLabelText(/fin ejecutivo/i)).toBeDisabled();
    expect(onStatus).toHaveBeenCalledWith({
      key: 'reports:executive:export-pdf',
      level: 'info',
      message: 'Preparando PDF ejecutivo...',
      toast: false,
    });
  });

  it('reports PDF export completion and failure with the same operation key', async () => {
    const onStatus = vi.fn();
    downloadExecutivePdf.mockResolvedValueOnce(new Blob(['pdf'], { type: 'application/pdf' }));
    const view = renderExecutive({ onStatus });

    fireEvent.click(screen.getByRole('button', { name: /pdf ejecutivo/i }));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'reports:executive:export-pdf',
      level: 'success',
    })));

    view.unmount();
    onStatus.mockClear();
    downloadExecutivePdf.mockRejectedValueOnce(new Error('Fallo controlado'));
    renderExecutive({ onStatus });
    fireEvent.click(screen.getByRole('button', { name: /pdf ejecutivo/i }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      key: 'reports:executive:export-pdf',
      level: 'error',
    })));
  });
});

async function selectDate(label: RegExp, date: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: date } });
}
