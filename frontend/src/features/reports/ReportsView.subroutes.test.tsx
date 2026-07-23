import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getExecutiveReport: vi.fn().mockRejectedValue(new Error('empty')),
      getCashSessions: vi.fn().mockResolvedValue({
        data: [],
        meta: { current_page: 1, per_page: 5, total: 0 },
      }),
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
  canViewAuditReports = canViewManagerial,
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
                canBrowseCashSessions={canViewCashSessionReport}
                canExport
                canViewCashSessionReport={canViewCashSessionReport}
                canViewAuditReports={canViewAuditReports}
                canViewManagerial={canViewManagerial}
                onStatus={vi.fn()}
              />
            )}
          />
          <Route
            path="/reports"
            element={(
              <ReportsView
                canBrowseCashSessions={canViewCashSessionReport}
                canExport
                canViewCashSessionReport={canViewCashSessionReport}
                canViewAuditReports={canViewAuditReports}
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
  it('renders the three report sub-route links without retired tabs', () => {
    renderReports('/reports');
    expect(screen.getByRole('heading', { level: 1, name: /^informes y auditoría$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resumen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /caja/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /auditoría/i })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /resumen del período/i })).toBeInTheDocument();
  });

  it('exposes concise descriptions for each report section link', () => {
    renderReports('/reports');

    expect(screen.getByRole('link', { name: /resumen/i })).toHaveAccessibleDescription(
      /cobros, pendientes, ticket promedio, tendencia y servicios/i,
    );
    expect(screen.getByRole('link', { name: /caja/i })).toHaveAccessibleDescription(
      /sesiones, cajeros, metodos y diferencias/i,
    );
    expect(screen.getByRole('link', { name: /auditoría/i })).toHaveAccessibleDescription(
      /anulaciones, reversos, cambios de precio y fiscales/i,
    );
  });

  it('uses a compact three-option navigation on mobile without losing descriptions', () => {
    renderReports('/reports');

    const navigation = screen.getByRole('navigation', { name: /secciones de reportes/i });
    expect(navigation).toHaveAttribute('data-mobile-layout', 'compact');
    expect(navigation).toHaveClass('grid-cols-3');
    expect(screen.getByRole('link', { name: /resumen/i })).toHaveClass('min-h-12');
    expect(screen.getByText(/cobros, pendientes/i)).toHaveClass('hidden', 'sm:block');
  });

  it('hides sub-routes when the user lacks managerial permission', async () => {
    renderReports('/reports', false);
    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /resumen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /auditoría/i })).not.toBeInTheDocument();
  });

  it('opens the cash report from root when it is the only permitted report', async () => {
    renderReports('/reports', false, true);
    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());

    expect(screen.getByRole('link', { name: /caja/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/operación de caja/i)).toBeInTheDocument();
    expect(screen.queryByText(/reporte ejecutivo no disponible/i)).not.toBeInTheDocument();
  });

  it('opens the cash report from a restricted report sub-route when it is the only permitted report', async () => {
    renderReports('/reports/audit', false, true);
    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());

    expect(screen.getByRole('link', { name: /caja/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/operación de caja/i)).toBeInTheDocument();
    expect(screen.queryByText(/reporte de auditoria no disponible/i)).not.toBeInTheDocument();
  });

  it('hides the audit report when the user has managerial reports without audit permission', async () => {
    renderReports('/reports/audit', true, true, false);

    expect(screen.queryByRole('link', { name: /auditoría/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /caja/i })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(apiClient.getCashSessions).toHaveBeenCalled());
  });

  it('opens audit from root when it is the only permitted report', () => {
    renderReports('/reports', false, false, true);

    expect(screen.getByRole('link', { name: /auditoría/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: /^auditoría$/i })).toBeInTheDocument();
    expect(screen.queryByText(/reporte ejecutivo no disponible/i)).not.toBeInTheDocument();
  });

  it('falls back to executive when the report sub-route is unknown', () => {
    renderReports('/reports/desconocido');

    expect(screen.getByRole('link', { name: /resumen/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: /resumen del período/i })).toBeInTheDocument();
  });

  it('shows empty state in executive sub-route without permissions', () => {
    renderReports('/reports/executive', false, false);
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
