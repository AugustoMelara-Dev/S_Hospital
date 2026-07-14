import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InvoiceHistoryFilters } from './InvoiceHistoryFilters';

describe('InvoiceHistoryFilters', () => {
  it('keeps DatePicker changes as a draft until Buscar applies the API date format', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <InvoiceHistoryFilters
        filters={{ date_from: '2026-06-15', page: 1, per_page: 10 }}
        hasActiveFilters
        loading={false}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /filtros avanzados/i }));
    await user.click(screen.getByLabelText('Desde'));

    const firstDay = await screen.findByTitle('2026-06-01');
    await user.click(firstDay);

    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      date_from: '2026-06-01',
      page: 1,
    })));
    expect(screen.getByLabelText('Desde')).toHaveValue('01/06/2026');
  });

  it('does not apply text filters while the cashier is still typing', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <InvoiceHistoryFilters
        filters={{ page: 3, per_page: 10 }}
        hasActiveFilters={false}
        loading={false}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/paciente/i), 'Maria Lopez');
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /buscar/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ patient: 'Maria Lopez', page: 1 }));
  });
});
