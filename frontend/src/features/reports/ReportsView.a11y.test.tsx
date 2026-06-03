import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ReportsView } from './ReportsView';
import {
  apiClient,
  type AreaIncomeReport,
  type CashSession,
  type CashSessionReport,
  type Category,
  type CategoryReport,
  type DailyReport,
  type IncomeReport,
  type MonthlyReport,
  type OperationsReport,
  type ServiceSalesReport,
} from '../../lib/api';

describe('ReportsView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getDailyReport').mockResolvedValue(mockDailyReport());
    vi.spyOn(apiClient, 'getMonthlyReport').mockResolvedValue(mockMonthlyReport());
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue(mockCategories());
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCashSessions').mockResolvedValue({
      data: mockCashSessions(),
      meta: { current_page: 1, per_page: 50, total: 1 },
    });
    vi.spyOn(apiClient, 'getIncomeReport').mockResolvedValue(mockIncomeReport());
    vi.spyOn(apiClient, 'getCategoryReport').mockResolvedValue(mockCategoryReport());
    vi.spyOn(apiClient, 'getAreaIncomeReport').mockResolvedValue(mockAreaIncomeReport());
    vi.spyOn(apiClient, 'getServiceSalesReport').mockResolvedValue(mockServiceSalesReport());
    vi.spyOn(apiClient, 'getOperationsReport').mockResolvedValue(mockOperationsReport());
    vi.spyOn(apiClient, 'getCashSessionReport').mockResolvedValue(mockCashSessionReport());

    const { container } = render(
      <ReportsView
        canExport
        canViewCashSessionReport
        canViewManagerial
        onStatus={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('h1, [role="heading"]')).not.toBeNull();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

function mockDailyReport(): DailyReport {
  return {
    date: '2026-06-02',
    total_billed: '28.75',
    total_collected: '17.25',
    total_pending: '11.50',
    total_partial: '0.00',
    total_voided: '0.00',
    invoice_count: 2,
    payment_count: 1,
    payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
    invoices_by_status: {
      issued: { count: 1, total: '11.50' },
      partial: { count: 0, total: '0.00' },
      paid: { count: 1, total: '17.25' },
      void: { count: 0, total: '0.00' },
    },
  };
}

function mockMonthlyReport(): MonthlyReport {
  return {
    month: '2026-05',
    date_from: '2026-05-01',
    date_to: '2026-05-31',
    total_billed: '57.50',
    total_collected: '22.25',
    total_pending: '35.25',
    total_partial: '11.50',
    total_voided: '17.25',
    invoice_count: 4,
    payment_count: 2,
    payments_by_method: { cash: '17.25', transfer: '5.00', card: '0.00', other: '0.00' },
    invoices_by_status: {
      issued: { count: 1, total: '28.75' },
      partial: { count: 1, total: '11.50' },
      paid: { count: 1, total: '17.25' },
      void: { count: 1, total: '17.25' },
    },
    daily_totals: [
      {
        date: '2026-05-03',
        total_billed: '17.25',
        total_collected: '17.25',
        total_pending: '0.00',
        total_partial: '0.00',
        total_voided: '0.00',
        invoice_count: 1,
        payment_count: 1,
      },
    ],
  };
}

function mockCategories(): Category[] {
  return [
    { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
  ];
}

function mockCashSessions(): CashSession[] {
  return [
    {
      id: 7,
      user_id: 2,
      status: 'open',
      opening_amount: '500.00',
      closing_amount: null,
      expected_amount: null,
      difference_amount: null,
      opening_notes: null,
      closing_notes: null,
      opened_at: '2026-06-02T08:00:00.000000Z',
      closed_at: null,
    },
  ];
}

function mockIncomeReport(): IncomeReport {
  return {
    date_from: '2026-06-02',
    date_to: '2026-06-02',
    cash_session_id: null,
    user_id: null,
    filters: {
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      category_id: null,
      area_id: null,
      user_id: null,
      cash_session_id: null,
      method: null,
      status: null,
    },
    total_billed: '0.00',
    total_collected: '0.00',
    total_pending: '0.00',
    total_partial: '0.00',
    total_voided: '0.00',
    payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
    payment_count: 0,
    invoice_count: 0,
  };
}

function mockCategoryReport(): CategoryReport {
  return {
    date_from: '2026-06-02',
    date_to: '2026-06-02',
    amount_basis: 'billed',
    amount_label: 'Facturado',
    amount_source: 'invoice_items.line_total',
    filters: {
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      category_id: null,
      area_id: null,
      user_id: null,
      cash_session_id: null,
      method: null,
      status: null,
    },
    categories: [],
  };
}

function mockAreaIncomeReport(): AreaIncomeReport {
  return {
    date_from: '2026-06-02',
    date_to: '2026-06-02',
    amount_basis: 'billed',
    amount_label: 'Facturado',
    amount_source: 'invoice_items.line_total',
    filters: {
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      category_id: null,
      area_id: null,
      user_id: null,
      cash_session_id: null,
      method: null,
      status: null,
    },
    areas: [],
  };
}

function mockServiceSalesReport(): ServiceSalesReport {
  return {
    date_from: '2026-06-02',
    date_to: '2026-06-02',
    amount_basis: 'billed',
    amount_label: 'Facturado',
    amount_source: 'invoice_items.line_total',
    filters: {
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      category_id: null,
      area_id: null,
      user_id: null,
      cash_session_id: null,
      method: null,
      status: null,
    },
    services: [],
  };
}

function mockOperationsReport(): OperationsReport {
  return {
    date_from: '2026-06-02',
    date_to: '2026-06-02',
    filters: {
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      category_id: null,
      area_id: null,
      user_id: null,
      cash_session_id: null,
      method: null,
      status: null,
    },
    summary: {
      void_count: 0,
      reprint_count: 0,
      backup_count: 0,
      failed_backup_count: 0,
      cashier_count: 0,
    },
    voids: [],
    reprints: [],
    backups: [],
    cashiers: [],
  };
}

function mockCashSessionReport(): CashSessionReport {
  return {
    cash_session: {
      id: 7,
      user_id: 2,
      status: 'open',
      opening_amount: '500.00',
      closing_amount: null,
      expected_amount: null,
      difference_amount: null,
      opening_notes: null,
      closing_notes: null,
      opened_at: '2026-06-02T08:00:00.000000Z',
      closed_at: null,
      user: { id: 2, name: 'Cajero Validacion', username: 'cajero.validacion' },
    },
    totals_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
    total_cash: '0.00',
    total_transfer: '0.00',
    total_card: '0.00',
    total_other: '0.00',
    payments_count: 0,
    payments_total: '0.00',
    expected_cash_amount: '500.00',
    pending_invoice_count: 0,
    pending_amount: '0.00',
    payments: [],
    movements: [],
  };
}
