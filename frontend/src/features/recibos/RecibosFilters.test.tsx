import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { CashSession } from '@/lib/api';
import { RecibosFilters } from './RecibosFilters';

function cashSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 4,
    user_id: 2,
    opening_amount: '100.00',
    closing_amount: null,
    expected_amount: null,
    difference_amount: null,
    status: 'closed',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-18T08:00:00.000000Z',
    closed_at: '2026-09-18T16:00:00.000000Z',
    user: { id: 2, name: 'Cajera Ana', username: 'ana' },
    ...overrides,
  };
}

function renderFilters(overrides: Partial<ComponentProps<typeof RecibosFilters>> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  render(
    <RecibosFilters
      filters={{ page: 1, per_page: 10 }}
      hasActiveFilters={false}
      loading={false}
      canFilterByCash={false}
      cashSessions={[]}
      cashSessionsLoading={false}
      onApply={onApply}
      onClear={onClear}
      {...overrides}
    />,
  );

  return { onApply, onClear };
}

describe('RecibosFilters', () => {
  it('busca por nombre solo al confirmar, con una sola barra', async () => {
    const user = userEvent.setup();
    const { onApply } = renderFilters();

    await user.type(screen.getByLabelText(/paciente o número/i), 'María López');
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^buscar$/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ patient: 'María López', invoice_number: '' }));
  });

  it('interpreta un número de documento en la misma barra', async () => {
    const user = userEvent.setup();
    const { onApply } = renderFilters();

    await user.type(screen.getByLabelText(/paciente o número/i), '000-001-01-00000010');
    await user.click(screen.getByRole('button', { name: /^buscar$/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ invoice_number: '000-001-01-00000010', patient: '' }),
    );
  });

  it('rechaza un rango de fechas inválido sin buscar', () => {
    const { onApply } = renderFilters();

    fireEvent.change(screen.getByLabelText(/^desde$/i), { target: { value: '2026-09-18' } });
    fireEvent.change(screen.getByLabelText(/^hasta$/i), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/no puede ser posterior/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('oculta la caja cuando no está autorizada', () => {
    renderFilters();
    expect(screen.queryByLabelText(/caja autorizada/i)).not.toBeInTheDocument();
  });

  it('ofrece la caja autorizada y permite limpiar', () => {
    const { onClear } = renderFilters({
      canFilterByCash: true,
      cashSessions: [cashSession()],
      hasActiveFilters: true,
    });

    expect(screen.getByLabelText(/caja autorizada/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Turno de caja · Cajera Ana/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('integra el período como un solo control agrupado, no dos campos sueltos', () => {
    renderFilters();

    const period = screen.getByRole('group', { name: /período/i });
    expect(within(period).getByLabelText(/^desde$/i)).toBeInTheDocument();
    expect(within(period).getByLabelText(/^hasta$/i)).toBeInTheDocument();
  });

  it('mantiene una sola barra de búsqueda dominante con las acciones en la misma fila', () => {
    renderFilters();

    const form = screen.getByRole('search', { name: /búsqueda de operaciones/i });
    expect(within(form).getByLabelText(/paciente o número/i)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: /^buscar$/i })).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: /^limpiar$/i })).toBeInTheDocument();
  });
});
