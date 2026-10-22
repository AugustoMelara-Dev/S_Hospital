import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cash, type CashSession } from '@/lib/api';
import { CashSessionHistory } from './CashSessionHistory';

function session(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 12,
    user_id: 4,
    cash_register_id: 2,
    cash_register: { id: 2, name: 'Caja Emergencia', code: 'EMERG-01' },
    user: { id: 4, name: 'Cajera Central', username: 'cajera' },
    opening_amount: '100.00',
    closing_amount: null,
    expected_amount: '100.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-28T08:00:00-06:00',
    closed_at: null,
    ...overrides,
  };
}

function renderHistory(canViewInvoices = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CashSessionHistory visible canViewInvoices={canViewInvoices} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CashSessionHistory', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads real sessions and preserves pending amounts apart from legitimate zero', async () => {
    vi.spyOn(cash, 'getCashSessions').mockResolvedValue({
      data: [
        session(),
        session({
          id: 11,
          status: 'closed',
          closing_amount: '0.00',
          difference_amount: '0.00',
          closed_at: '2026-09-28T10:00:00-06:00',
        }),
      ],
      meta: { current_page: 1, per_page: 10, total: 2 },
    });

    renderHistory();

    const table = await screen.findByRole('table', { name: /turnos de caja registrados/i });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent(/#12.*caja emergencia.*EMERG-01.*abierta.*pendiente.*pendiente/i);
    expect(rows[2]).toHaveTextContent(/#11.*cerrada.*L\. 0\.00.*L\. 0\.00/i);
    expect(within(rows[1]).getByRole('link', { name: /ver operaciones/i })).toHaveAttribute(
      'href',
      '/recibos?reconciliation_cash_session_id=12',
    );
  });

  it('paginates through the server result without replacing missing values with zero', async () => {
    const getCashSessions = vi.spyOn(cash, 'getCashSessions')
      .mockResolvedValueOnce({
        data: [session()],
        meta: { current_page: 1, per_page: 10, total: 11 },
      })
      .mockResolvedValueOnce({
        data: [session({ id: 2, status: 'closed', closing_amount: '125.00', difference_amount: '25.00' })],
        meta: { current_page: 2, per_page: 10, total: 11 },
      });

    renderHistory(false);
    await screen.findByText('#12');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(getCashSessions).toHaveBeenLastCalledWith({ page: 2, perPage: 10 }));
    expect(await screen.findByText('#2')).toBeVisible();
    expect(screen.queryByRole('link', { name: /ver operaciones/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/sin acceso a recibos/i).length).toBeGreaterThan(0);
  });
});
