import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/api';
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
      expect(document.body.textContent).toContain('L. 275.50');
    });
    expect(document.body.textContent).not.toMatch(/ventas|ingresos cobrados|flujo/i);
  });
});
