import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsExecutive } from './ReportsExecutive';
import { buildExecutiveReport } from './components/testUtils';

vi.mock('@/hooks/useExecutiveReport', () => ({
  useExecutiveReport: () => ({
    data: buildExecutiveReport(),
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    error: null,
  }),
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

const downloadExecutivePdf = vi.hoisted(() => vi.fn());

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
  it('renders operational alerts with the executive report content', () => {
    render(
      <ReportsExecutive
        canExport
        canViewManagerial
        onStatus={vi.fn()}
      />,
    );

    expect(screen.getByTestId('executive-summary')).toBeInTheDocument();
    expect(screen.getByTestId('executive-alerts')).toBeInTheDocument();
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
