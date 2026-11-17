import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '@/auth/guards';
import { makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import CatalogoPage from './CatalogoPage';

const service = {
  id: 7,
  name: 'Hemograma completo',
  category: { id: 1, name: 'Laboratorio' },
  area: null,
  price_cents: 25000,
  tax_rate: null,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  aliases: '',
  description: '',
};

function baseRoutes(extra: Record<string, unknown> = {}, perms?: Parameters<typeof makeMe>[0]) {
  return mockApi({
    'GET /auth/me': makeMe(perms),
    'GET /categories': { items: [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }], page: 1, per_page: 1, total: 1 },
    'GET /areas': { items: [], page: 1, per_page: 1, total: 0 },
    'GET /tax-rates': { items: [{ id: 3, name: 'ISV', rate_bp: 1500, active: true, is_default: true }], page: 1, per_page: 1, total: 1 },
    'GET /services': { items: [service], page: 1, per_page: 25, total: 1 },
    ...extra,
  });
}

const renderPage = () =>
  renderWithProviders(
    <RequireAuth>
      <CatalogoPage />
    </RequireAuth>,
    { path: '/admin/catalogo' },
  );

describe('CatalogoPage', () => {
  it('requires a price reason when the price changes and sends it as `reason`', async () => {
    const user = userEvent.setup();
    const api = baseRoutes({ 'PATCH /services/:id': ({ body }: { body: object }) => ({ ...service, ...body }) });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Editar Hemograma completo' }));
    const drawer = await screen.findByRole('dialog', { name: 'Editar concepto' });
    const price = within(drawer).getByLabelText(/Precio/);
    await user.clear(price);
    await user.type(price, '300');

    const reasonLabel = await within(drawer).findByLabelText(/Motivo del cambio de precio/);
    await user.click(within(drawer).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(drawer).findByText('Escriba un motivo de al menos 5 caracteres.')).toBeInTheDocument();
    expect(api.calls('PATCH /services/:id')).toHaveLength(0);

    await user.type(reasonLabel, 'Ajuste de tarifa 2026');
    await user.click(within(drawer).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.calls('PATCH /services/:id')).toHaveLength(1));
    expect(api.calls('PATCH /services/:id')[0]?.body).toEqual({ price_cents: 30000, reason: 'Ajuste de tarifa 2026' });
  });

  it('shows server field errors inline', async () => {
    const user = userEvent.setup();
    const { apiError } = await import('@/test/mockApi');
    baseRoutes({ 'PATCH /services/:id': apiError(422, 'validation_error', 'Revise los datos ingresados.', { name: 'Ya existe un concepto con ese nombre.' }) });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Editar Hemograma completo' }));
    const drawer = await screen.findByRole('dialog', { name: 'Editar concepto' });
    const name = within(drawer).getByLabelText(/Nombre/);
    await user.type(name, ' B');
    await user.click(within(drawer).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(drawer).findByText('Ya existe un concepto con ese nombre.')).toBeInTheDocument();
  });

  it('import preview shows valid count and per-line errors', async () => {
    const user = userEvent.setup();
    const api = baseRoutes({
      'POST /services/import': ({ query }: { query: URLSearchParams }) => ({
        mode: query.get('mode'),
        applied: false,
        summary: { total: 3, create: 1, update: 1, unchanged: 0, error: 1, new_categories: [] },
        lines: [
          { line: 2, category: 'Laboratorio', name: 'Glucosa', action: 'create', errors: [] },
          { line: 3, category: 'Laboratorio', name: 'Hemograma completo', action: 'update', errors: [] },
          { line: 4, category: 'Laboratorio', name: 'Urea', action: 'error', errors: ['Precio inválido: "abc".'] },
        ],
      }),
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Importar / Exportar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Importar / Exportar' });
    const file = new File(['categoria,servicio,precio_lps\n'], 'catalogo.csv', { type: 'text/csv' });
    await user.upload(within(dialog).getByLabelText('Archivo CSV'), file);
    await user.click(within(dialog).getByRole('button', { name: 'Revisar archivo' }));

    expect(await within(dialog).findByText('2 líneas válidas')).toBeInTheDocument();
    expect(within(dialog).getByText('Precio inválido: "abc".')).toBeInTheDocument();
    expect(within(dialog).getByText('Urea')).toBeInTheDocument();
    expect(api.calls('POST /services/import')[0]?.query.get('mode')).toBe('preview');
    expect(api.calls('POST /services/import')[0]?.body).toBeInstanceOf(FormData);
  });

  it('hides write actions without catalog.manage', async () => {
    baseRoutes({}, { role: { code: 'cajero', name: 'Caja' }, permissions: ['catalog.view'] });
    renderPage();
    expect(await screen.findByText('Hemograma completo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo concepto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Impuesto en lote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Hemograma completo' })).not.toBeInTheDocument();
  });
});
