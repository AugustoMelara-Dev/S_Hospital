import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getExecutiveReport: vi.fn().mockRejectedValue(new Error('empty')),
      getCashSessionReport: vi.fn(),
      downloadExecutivePdf: vi.fn(),
      downloadExecutiveExcel: vi.fn(),
    },
  };
});

const { apiClient } = await import('@/lib/api');

vi.mock('@/hooks/useCashSession', () => ({
  useCashSession: () => ({ data: null }),
}));

vi.mock('@/hooks/useExecutiveReport', () => ({
  useExecutiveReport: () => ({
    data: undefined,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    error: null,
  }),
}));

import { ReportsView } from './ReportsView';

function renderReports(
  initialPath: string,
  canViewManagerial = true,
  canViewCashSessionReport = true,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/reports/*"
            element={(
              <ReportsView
                canExport
                canViewCashSessionReport={canViewCashSessionReport}
                canViewManagerial={canViewManagerial}
                onStatus={vi.fn()}
              />
            )}
          />
          <Route
            path="/reports"
            element={(
              <ReportsView
                canExport
                canViewCashSessionReport={canViewCashSessionReport}
                canViewManagerial={canViewManagerial}
                onStatus={vi.fn()}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsView (sub-routes)', () => {
  it('renders the three sub-route tabs', () => {
    renderReports('/reports');
    expect(screen.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ejecutivo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /caja/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /auditoria/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /control ejecutivo/i })).toBeInTheDocument();
  });

  it('hides sub-routes when the user lacks managerial permission', () => {
    renderReports('/reports', false);
    expect(screen.queryByRole('link', { name: /ejecutivo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /auditoria/i })).not.toBeInTheDocument();
  });

  it('opens the cash report from root when it is the only permitted report', () => {
    renderReports('/reports', false, true);

    expect(screen.getByRole('link', { name: /caja/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/operacion de caja/i)).toBeInTheDocument();
    expect(screen.queryByText(/reporte ejecutivo no disponible/i)).not.toBeInTheDocument();
  });

  it('falls back to executive when the report sub-route is unknown', () => {
    renderReports('/reports/desconocido');

    expect(screen.getByRole('link', { name: /ejecutivo/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: /control ejecutivo/i })).toBeInTheDocument();
  });

  it('shows empty state in executive sub-route without permissions', () => {
    renderReports('/reports/executive', false);
    expect(screen.getByText(/reporte ejecutivo no disponible/i)).toBeInTheDocument();
  });

  it('does not expose cash lookup controls without cash report permission', () => {
    renderReports('/reports/cash', false, false);

    expect(screen.getByText(/reporte de caja no disponible/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/numero de caja/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver caja/i })).not.toBeInTheDocument();
    expect(apiClient.getCashSessionReport).not.toHaveBeenCalled();
  });
});
