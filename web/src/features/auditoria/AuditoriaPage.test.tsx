import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '@/auth/guards';
import { makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import AuditoriaPage from './AuditoriaPage';

const log = {
  id: 9,
  user_id: 1,
  user_name: 'Ana Martínez',
  action: 'service.price_changed',
  entity_type: 'service',
  entity_id: 7,
  result: 'success',
  reason: 'Ajuste de tarifa',
  old_values: { price_cents: 25000, name: 'Hemograma' },
  new_values: { price_cents: 30000, name: 'Hemograma' },
  ip: '192.168.1.20',
  created_at: '2026-11-17T09:15:00-06:00',
};

describe('AuditoriaPage', () => {
  it('builds the query from filters and shows the detail diff', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /auth/me': makeMe(),
      'GET /audit-logs': { items: [log], page: 1, per_page: 25, total: 1 },
    });
    renderWithProviders(
      <RequireAuth>
        <AuditoriaPage />
      </RequireAuth>,
    );
    expect(await screen.findByText('Cambio de precio', { selector: 'td span' })).toBeInTheDocument();
    expect(screen.getByText('Correcto')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Usuario'), 'ana');
    await user.selectOptions(screen.getByLabelText('Acción'), 'service.price_changed');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-17' } });

    await waitFor(() => {
      const q = api.calls('GET /audit-logs').at(-1)?.query;
      expect(q?.get('search')).toBe('ana');
      expect(q?.get('action')).toBe('service.price_changed');
      expect(q?.get('date_from')).toBe('2026-11-01');
      expect(q?.get('date_to')).toBe('2026-11-17');
      expect(q?.get('page')).toBe('1');
    });

    await user.click(screen.getByText('Cambio de precio', { selector: 'td span' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cambio de precio' });
    const row = within(dialog).getByRole('rowheader', { name: 'price_cents' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('25000')).toBeInTheDocument();
    expect(within(row).getByText('30000')).toBeInTheDocument();
    expect(within(dialog).getByText('Ajuste de tarifa')).toBeInTheDocument();
  });
});
