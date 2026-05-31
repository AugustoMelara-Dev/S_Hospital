import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api';
import { DashboardView } from './DashboardView';

describe('DashboardView financial labels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      needs_setup: false,
      steps: {
        fiscal_settings: true,
        admin_exists: true,
        catalog_has_services: true,
        fiscal_sequence_exists: true,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('uses precise financial labels instead of sales wording for billed and collected facts', async () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockResolvedValue({
      current_month: {
        total_billed: '275.50',
        total_collected: '125.25',
        invoice_count: 3,
        payment_count: 2,
      },
      last_7_days: [
        {
          date: '2026-05-30',
          total_billed: '275.50',
          total_collected: '125.25',
          invoice_count: 3,
          payment_count: 2,
        },
      ],
      payments_by_method: {
        cash: '0.00',
        transfer: '0.00',
        card: '0.00',
        other: '0.00',
      },
      top_services: [],
      cashiers_summary: [],
    });

    render(
      <DashboardView
        canCreateInvoices
        canViewBackups
        canViewCash
        canViewCatalog
        canViewFiscalSettings
        canViewInvoices
        canViewManagerialReports
        canViewReports
        cashSession={null}
        onQuickCash={vi.fn()}
        onQuickInvoice={vi.fn()}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: /facturacion y cobros/i })).toBeInTheDocument();
    expect(screen.getByText(/sin cobros registrados hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/sin servicios facturados este mes/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/L\. 275[,.]50/);
    });
    expect(document.body.textContent).not.toMatch(/ventas|ingresos cobrados|flujo/i);
  });

  it('hides technical dashboard failures behind an operator-safe message', async () => {
    vi.spyOn(apiClient, 'getDashboardReport').mockRejectedValue(
      new ApiError('SQLSTATE[HY000]: stack trace in storage/logs/laravel.log', 500),
    );
    const onStatus = vi.fn();

    render(
      <DashboardView
        canCreateInvoices
        canViewBackups
        canViewCash
        canViewCatalog
        canViewFiscalSettings
        canViewInvoices
        canViewManagerialReports
        canViewReports
        cashSession={null}
        onQuickCash={vi.fn()}
        onQuickInvoice={vi.fn()}
        onStatus={onStatus}
      />,
    );

    expect(await screen.findAllByText(/el servidor lan no pudo completar la operacion/i)).not.toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/i);
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/servidor lan/i));
  });
});
