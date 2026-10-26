import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cash, type CashSession } from '@/lib/api';
import { CashSessionHistory } from './CashSessionHistory';
import { filtersFromSearchParams } from '@/features/invoices/history/invoiceHistoryParams';

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
  beforeEach(() => {
    vi.spyOn(cash, 'getCashSessionOptions').mockImplementation(async ({ kind }) => ({ data: [{ value: kind === 'registers' ? '2' : '4', label: kind === 'registers' ? 'Caja Emergencia' : 'Cajera Central' }], selected: null, meta: { current_page: 1, per_page: 20, total: 1 } }));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies dates, register, operator and shortage filters to the complete server history', async () => {
    const getSessions = vi.spyOn(cash, 'getCashSessions').mockImplementation(async (filters) => ({ data: filters?.difference ? [] : [session()], meta: { current_page: 1, per_page: 10, total: filters?.difference ? 0 : 1 } }));
    renderHistory();
    await screen.findByRole('option', { name: 'Caja Emergencia' });
    fireEvent.change(screen.getByLabelText('Desde apertura'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('Hasta apertura'), { target: { value: '2026-06-02' } });
    fireEvent.change(screen.getByLabelText('Caja física del histórico'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Operador del histórico'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Diferencia del cierre'), { target: { value: 'shortage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar al histórico' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 1, perPage: 10, date_from: '2026-06-01', date_to: '2026-06-02', cash_register_id: 2, user_id: 4, difference: 'shortage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar histórico' }));
    expect(await screen.findByRole('table', { name: /turnos de caja registrados/i })).toBeVisible();
    expect(screen.getByLabelText('Desde apertura')).toHaveValue('');
  });

  it('does not request an inverted date range', async () => {
    const getSessions = vi.spyOn(cash, 'getCashSessions').mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 10, total: 0 } });
    renderHistory();
    await waitFor(() => expect(getSessions).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Desde apertura'), { target: { value: '2026-06-03' } });
    fireEvent.change(screen.getByLabelText('Hasta apertura'), { target: { value: '2026-06-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar al histórico' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha inicial no puede ser posterior a la final.');
    expect(getSessions).toHaveBeenCalledOnce();
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
    expect(rows[1]).toHaveTextContent(/28\/09\/2026.*caja emergencia.*abierta.*pendiente.*pendiente/i);
    expect(rows[2]).toHaveTextContent(/28\/09\/2026.*cerrada.*L\. 0\.00.*L\. 0\.00/i);
    // Ni el número interno del turno ni el código de la caja física.
    expect(table).not.toHaveTextContent(/#12|#11|EMERG-01/);
    expect(within(rows[1]).getByRole('link', { name: /ver operaciones/i })).toHaveAttribute(
      'href',
      '/recibos?cash_session_id=12',
    );
    const href = within(rows[1]).getByRole('link', { name: /ver operaciones/i }).getAttribute('href')!;
    expect(filtersFromSearchParams(new URL(href, 'http://hospital.local').searchParams).cash_session_id).toBe('12');
  });

  it('paginates through the server result without replacing missing values with zero', async () => {
    const getCashSessions = vi.spyOn(cash, 'getCashSessions')
      .mockResolvedValueOnce({
        data: [session()],
        meta: { current_page: 1, per_page: 10, total: 11 },
      })
      .mockResolvedValueOnce({
        data: [session({ id: 2, status: 'closed', opened_at: '2026-09-27T07:30:00-06:00', closing_amount: '125.00', difference_amount: '25.00' })],
        meta: { current_page: 2, per_page: 10, total: 11 },
      });

    renderHistory(false);
    await screen.findAllByText(/28\/09\/2026/);
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(getCashSessions).toHaveBeenLastCalledWith({ page: 2, perPage: 10 }));
    expect((await screen.findAllByText(/27\/09\/2026/))[0]).toBeVisible();
    expect(screen.queryByRole('link', { name: /ver operaciones/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/sin acceso a recibos/i).length).toBeGreaterThan(0);
  });
});
