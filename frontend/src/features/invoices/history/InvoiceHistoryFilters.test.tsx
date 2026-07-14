import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InvoiceHistoryFilters } from './InvoiceHistoryFilters';

describe('InvoiceHistoryFilters', () => {
  it('opens the real DatePicker and emits its API date format after selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <InvoiceHistoryFilters
        filters={{ date_from: '2026-06-15', page: 1, per_page: 10 }}
        hasActiveFilters
        loading={false}
        onChange={onChange}
        onClear={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /filtros avanzados/i }));
    await user.click(screen.getByLabelText('Desde'));

    const firstDay = await screen.findByTitle('2026-06-01');
    await user.click(firstDay);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      date_from: '2026-06-01',
      page: 1,
    })));
    expect(screen.getByLabelText('Desde')).toHaveValue('01/06/2026');
  });
});
