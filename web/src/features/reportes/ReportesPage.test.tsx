import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Permission, ReportSummary } from '@/api/types';
import { makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import ReportesPage from './ReportesPage';

const summary: ReportSummary = {
  summary: {
    billed_cents: 250_000,
    collected_cents: 200_000,
    pending_cents: 50_000,
    without_charge_count: 1,
    invoices_count: 5,
    paid_count: 4,
    partial_count: 0,
    average_ticket_cents: 50_000,
    voided_cents: 0,
    reversed_cents: 0,
    free_lines_count: 1,
    free_value_cents: 2_500,
  },
  by_method: [{ method: 'cash', count: 4, amount_cents: 200_000 }],
  daily: [{ date: '2026-11-17', billed_cents: 250_000, collected_cents: 200_000 }],
  operations: [],
  lines: [],
  payments: [],
  sessions: [],
  gratuities: [],
  top_services: [],
};

const own: Permission[] = ['reports.own', 'invoices.view'];

describe('ReportesPage', () => {
  it('hides export buttons without reports.export and shows the own-scope chip', async () => {
    mockApi({ 'GET /auth/me': makeMe({ permissions: own }), 'GET /reports/summary': summary });
    renderWithProviders(<ReportesPage />, { path: '/reportes' });
    expect(await screen.findByText('Solo sus operaciones')).toBeInTheDocument();
    expect(await screen.findByText('L 2,500.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar Excel' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cajero')).not.toBeInTheDocument();
  });

  it('shows export buttons and global filters for reports.all + reports.export', async () => {
    mockApi({
      'GET /auth/me': makeMe(),
      'GET /reports/summary': summary,
      'GET /users': { items: [{ id: 3, name: 'Luis Cajero' }], page: 1, per_page: 200, total: 1 },
      'GET /categories': [{ id: 2, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }],
    });
    renderWithProviders(<ReportesPage />, { path: '/reportes' });
    expect(await screen.findByRole('button', { name: 'Exportar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeInTheDocument();
    expect(screen.getByText('Todas las cajas')).toBeInTheDocument();
    expect(await screen.findByLabelText('Cajero')).toBeInTheDocument();
    expect(await screen.findByLabelText('Categoría')).toBeInTheDocument();
  });

  it('requests the current month by default and validates a custom range over 92 days', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /auth/me': makeMe({ permissions: own }), 'GET /reports/summary': summary });
    renderWithProviders(<ReportesPage />, { path: '/reportes' });
    await waitFor(() => expect(api.calls('GET /reports/summary')).toHaveLength(1));
    const q = api.calls('GET /reports/summary')[0]?.query;
    expect(q?.get('date_from')).toMatch(/^\d{4}-\d{2}-01$/);
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-06-30' } });
    expect(screen.getByText('Cambios sin aplicar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('El período no puede superar 92 días.')).toBeInTheDocument();
    expect(api.calls('GET /reports/summary')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(api.calls('GET /reports/summary')).toHaveLength(2));
    const q2 = api.calls('GET /reports/summary')[1]?.query;
    expect(q2?.get('date_from')).toBe('2026-01-01');
    expect(q2?.get('date_to')).toBe('2026-01-31');
  });
});
