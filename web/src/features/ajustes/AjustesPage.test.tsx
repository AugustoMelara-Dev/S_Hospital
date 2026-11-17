import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '@/auth/guards';
import { makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import AjustesPage from './AjustesPage';
import { FiscalTab } from './FiscalTab';
import { percentToBp } from './ImpuestosTab';

const seq = (over: object) => ({
  id: 1,
  prefix: '000-001-01',
  cai: 'ABC-123',
  min_number: 1,
  max_number: 5000,
  current_number: 10,
  valid_until: '2099-12-31',
  active: false,
  created_at: '2026-01-01T00:00:00-06:00',
  updated_at: '2026-01-01T00:00:00-06:00',
  ...over,
});

const receiptSettings = {
  series: [
    { id: 1, series: 'REC-A', prefix: 'REC-A', min_number: 1, max_number: 99999, current_number: 4, range_authorization: null, legal_text: null, number_color: '#b91c1c', active: true },
  ],
  profiles: [
    { id: 1, code: 'half_letter', name: 'Media carta', paper: 'half_letter', width_mm: 216, height_mm: 140, margins_mm: 8, copies_mode: 'original_only', show_seal_space: true, use_logo: true, active: true, is_default: true },
    { id: 2, code: 'thermal_80', name: 'Térmica 80', paper: 'thermal_80', width_mm: 80, height_mm: 200, margins_mm: 3, copies_mode: 'original_only', show_seal_space: false, use_logo: false, active: true, is_default: false },
  ],
};

describe('Ajustes', () => {
  it('fiscal sequence status chips', async () => {
    mockApi({
      'GET /auth/me': makeMe(),
      'GET /fiscal-sequences': {
        items: [
          seq({ id: 1, prefix: 'A-OK', active: true }),
          seq({ id: 2, prefix: 'B-OLD', valid_until: '2020-01-01' }),
          seq({ id: 3, prefix: 'C-LOW', current_number: 4950 }),
        ],
        page: 1,
        per_page: 3,
        total: 3,
      },
    });
    renderWithProviders(
      <RequireAuth>
        <FiscalTab />
      </RequireAuth>,
    );
    const rowOf = async (prefix: string) => (await screen.findByText(prefix)).closest('tr') as HTMLElement;

    const ok = await rowOf('A-OK');
    expect(within(ok).getByText('Activa')).toBeInTheDocument();
    expect(within(ok).getByText('Vigente')).toBeInTheDocument();
    expect(within(ok).queryByText('Rango por agotarse')).not.toBeInTheDocument();

    const old = await rowOf('B-OLD');
    expect(within(old).getByText('Vencida')).toBeInTheDocument();

    const low = await rowOf('C-LOW');
    expect(within(low).getByText('Rango por agotarse')).toBeInTheDocument();
    expect(within(low).getByText('50')).toBeInTheDocument();
  });

  it('new fiscal sequence previews the next number', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /auth/me': makeMe(), 'GET /fiscal-sequences': { items: [], page: 1, per_page: 1, total: 0 } });
    renderWithProviders(
      <RequireAuth>
        <FiscalTab />
      </RequireAuth>,
    );
    await user.click(await screen.findByRole('button', { name: 'Nueva numeración' }));
    const drawer = await screen.findByRole('dialog', { name: 'Nueva numeración fiscal' });
    await user.type(within(drawer).getByLabelText(/Prefijo/), '000-001-01');
    const desde = within(drawer).getByLabelText(/Desde/);
    await user.clear(desde);
    await user.type(desde, '201');
    expect(within(drawer).getByTestId('next-number')).toHaveTextContent('000-001-01-00000201');
  });

  it('hides tabs without permission', async () => {
    mockApi({
      'GET /auth/me': makeMe({ role: { code: 'soporte', name: 'Soporte técnico' }, permissions: ['receipt_settings.view', 'system.status'] }),
      'GET /receipt-settings': receiptSettings,
    });
    renderWithProviders(
      <RequireAuth>
        <AjustesPage />
      </RequireAuth>,
    );
    expect(await screen.findByRole('tab', { name: 'Impresión' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByRole('tab', { name: 'Identidad' })).not.toBeInTheDocument();
    // Thermal profiles are not offered as default; read-only without update permission.
    const select = await screen.findByLabelText('Perfil predeterminado');
    expect(within(select).queryByText('Térmica 80')).not.toBeInTheDocument();
    expect(select).toBeDisabled();
  });

  it('converts percentages to basis points without floats', () => {
    expect(percentToBp('15')).toBe(1500);
    expect(percentToBp('12.5')).toBe(1250);
    expect(percentToBp('0')).toBe(0);
    expect(percentToBp('abc')).toBeNull();
  });
});
