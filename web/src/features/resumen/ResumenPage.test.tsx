import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { Permission, ReportToday } from '@/api/types';
import { apiError, makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import ResumenPage, { greeting } from './ResumenPage';

const today: ReportToday = {
  date: '2026-11-17',
  scope: 'all',
  invoices_count: 3,
  payments_count: 3,
  recent_operations: [],
  billed_cents: 120_000,
  collected_cents: 100_000,
  pending_cents: 20_000,
  without_charge_count: 2,
  voided_count: 0,
  by_method: [{ method: 'cash', label: 'Efectivo', count: 3, amount_cents: 100_000 }],
  current_session: null,
  attention: { pending_count: 0, pending_cents: 0, missing_receipts_count: 0 },
};

const recent = {
  items: [
    {
      id: 41,
      number: '000-001-01-00000041',
      issued_at: '2026-11-17T09:15:00-06:00',
      patient_name: 'María López',
      status: 'paid',
      settlement: 'paid',
      total_cents: 35_000,
    },
  ],
  page: 1,
  per_page: 8,
  total: 1,
};

describe('ResumenPage', () => {
  it('greets in Honduras time', () => {
    expect(greeting(new Date('2026-11-17T14:00:00Z'))).toBe('Buenos días'); // 08:00 HN
    expect(greeting(new Date('2026-11-17T20:00:00Z'))).toBe('Buenas tardes'); // 14:00 HN
    expect(greeting(new Date('2026-11-18T02:00:00Z'))).toBe('Buenas noches'); // 20:00 HN
  });

  it('renders KPIs, recent operations and the empty attention state', async () => {
    mockApi({
      'GET /auth/me': makeMe(),
      'GET /reports/today': today,
      'GET /invoices': recent,
      'GET /cash-sessions/current': null,
    });
    renderWithProviders(<ResumenPage />);
    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    expect(await screen.findByTestId('resumen-saludo')).toHaveTextContent(/, Ana\./);
    expect(await screen.findByText('L 1,200.00')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '000-001-01-00000041' })).toHaveAttribute('href', '/recibos/41');
    expect(await screen.findByText('No hay pendientes que requieran acción')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cobrar/ })).toHaveAttribute('href', '/cobrar');
  });

  it('hides sections whose API answers 403', async () => {
    const perms: Permission[] = ['reports.own', 'invoices.view', 'cash.view'];
    const api = mockApi({
      'GET /auth/me': makeMe({ permissions: perms }),
      'GET /reports/today': apiError(403, 'forbidden', 'No tiene permiso para esta acción.'),
      'GET /invoices': recent,
      'GET /cash-sessions/current': null,
    });
    renderWithProviders(<ResumenPage />);
    expect(await screen.findByText('María López')).toBeInTheDocument();
    await screen.findByText('Sin caja abierta');
    expect(api.calls('GET /reports/today')).toHaveLength(1);
    expect(screen.queryByText('Facturado')).not.toBeInTheDocument();
    expect(screen.queryByText('Cobros por método')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cobrar/ })).not.toBeInTheDocument();
  });

  it('points pending operations to Recibos', async () => {
    mockApi({
      'GET /auth/me': makeMe(),
      'GET /reports/today': { ...today, attention: { pending_count: 3, pending_cents: 45_000, missing_receipts_count: 0 } },
      'GET /invoices': recent,
      'GET /cash-sessions/current': null,
    });
    renderWithProviders(<ResumenPage />);
    const link = await screen.findByRole('link', { name: /3 operaciones pendientes de cobro/ });
    expect(link).toHaveAttribute('href', '/recibos?pending=1');
  });
});
