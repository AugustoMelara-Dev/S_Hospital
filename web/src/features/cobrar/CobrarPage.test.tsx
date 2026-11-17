import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { InvoicePreviewRequest } from '@/api/types';
import { apiError, makeMe, mockApi, reply, type MockRoutes } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import CobrarPage from './CobrarPage';
import {
  cajero,
  hemograma,
  makeInvoice,
  makePayment,
  makeReceipt,
  openSession,
  previewFor,
  services,
} from './testFixtures';

function baseRoutes(overrides: MockRoutes = {}): MockRoutes {
  return {
    'GET /auth/me': cajero,
    'GET /cash-sessions/current': openSession,
    'GET /categories': [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }],
    'GET /services': ({ query }: { query: URLSearchParams }) => {
      const q = (query.get('search') ?? '').toLowerCase();
      const items = services.filter((s) => s.name.toLowerCase().includes(q));
      return { items, page: 1, per_page: 30, total: items.length };
    },
    'POST /invoices/preview': ({ body }: { body: unknown }) => previewFor(body as InvoicePreviewRequest),
    ...overrides,
  };
}

async function start(user: UserEvent, patient = 'María López') {
  const input = await screen.findByLabelText(/Nombre del paciente/);
  await waitFor(() => expect(input).toHaveFocus());
  await user.type(input, `${patient}{Enter}`);
  const search = screen.getByRole('combobox', { name: 'Buscar concepto' });
  expect(search).toHaveFocus();
  return search;
}

async function addByKeyboard(user: UserEvent, search: HTMLElement, term: string) {
  await user.type(search, term);
  await screen.findByRole('option', { name: new RegExp(term, 'i') });
  await user.keyboard('{Enter}');
}

const previewBodies = (api: ReturnType<typeof mockApi>) =>
  api.calls('POST /invoices/preview').map((c) => c.body as InvoicePreviewRequest);

beforeEach(() => {
  localStorage.clear();
});

describe('Cobrar', () => {
  it('adds concepts with the keyboard; repeating one adds +1 and focus returns to the search', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes());
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });

    const search = await start(user);
    await user.type(search, 'hemo');
    await screen.findByRole('option', { name: /Hemograma completo/ });
    await user.keyboard('{ArrowDown}{Enter}');

    const table = await screen.findByRole('table', { name: 'Conceptos de la cuenta' });
    expect(within(table).getByText('Hemoglobina glicosilada')).toBeInTheDocument();
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');

    // Enter typed before the debounce fires still adds the first result.
    await user.type(search, 'hemograma{Enter}');
    await waitFor(() => expect(within(table).getByText('Hemograma completo')).toBeInTheDocument());
    await user.type(search, 'hemograma{Enter}');
    await waitFor(() => expect(screen.getByLabelText('Cantidad de Hemograma completo')).toHaveValue('2'));

    await waitFor(() =>
      expect(previewBodies(api).at(-1)).toEqual({
        items: [
          { service_id: 11, quantity_hundredths: 100 },
          { service_id: 10, quantity_hundredths: 200 },
        ],
        dialysis_prescription: false,
      }),
    );
    expect(await screen.findByText('Listo para cobrar')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Cobrar · L 620\.50/ }).length).toBeGreaterThan(0);
    expect(api.unmatched).toEqual([]);
  });

  it('changing the quantity triggers a new preview and totals come from it', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes());
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);
    await addByKeyboard(user, search, 'Hemograma');
    await screen.findByText('Listo para cobrar');

    await user.click(screen.getByRole('button', { name: 'Aumentar cantidad de Hemograma completo' }));
    await waitFor(() => expect(previewBodies(api).at(-1)?.items[0]?.quantity_hundredths).toBe(200));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Cobrar · L 300\.00/ }).length).toBeGreaterThan(0));
  });

  it('shows the dialysis checkbox only for an EPO line and with permission', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes());
    const view = renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);

    await addByKeyboard(user, search, 'Hemograma');
    await screen.findByText('Listo para cobrar');
    expect(screen.queryByLabelText('Paciente con receta de diálisis')).not.toBeInTheDocument();

    await addByKeyboard(user, search, 'Eritropoyetina');
    const box = await screen.findByLabelText('Paciente con receta de diálisis');
    await user.click(box);
    await waitFor(() => expect(previewBodies(api).at(-1)?.dialysis_prescription).toBe(true));
    expect(await screen.findAllByText('Sin cobro por receta')).not.toHaveLength(0);
    view.unmount();
  });

  it('hides the dialysis checkbox without the permission', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      baseRoutes({
        'GET /auth/me': makeMe({ permissions: cajero.permissions.filter((p) => p !== 'patients.mark_dialysis_prescription') }),
      }),
    );
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);
    await addByKeyboard(user, search, 'Eritropoyetina');
    await screen.findByText('Listo para cobrar');
    expect(screen.queryByLabelText('Paciente con receta de diálisis')).not.toBeInTheDocument();
    expect(previewBodies(api).at(-1)?.dialysis_prescription).toBe(false);
  });

  it('blocks charging without an open cash session', async () => {
    const user = userEvent.setup();
    mockApi(baseRoutes({ 'GET /cash-sessions/current': null }));
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);
    await addByKeyboard(user, search, 'Hemograma');
    const status = await screen.findByText(/Abra caja antes de emitir y cobrar una factura\./);
    expect(within(status).getByRole('link', { name: 'Ir a Caja' })).toHaveAttribute('href', '/caja');
    for (const b of screen.getAllByRole('button', { name: /Cobrar · L 150\.00/ })) expect(b).toBeDisabled();
  });

  it('charges: posts invoice then payment with idempotency keys and shows the change', async () => {
    const user = userEvent.setup();
    const invoice = makeInvoice();
    const receipt = makeReceipt();
    const api = mockApi(
      baseRoutes({
        'POST /invoices': reply(201, invoice),
        'POST /invoices/:id/payments': {
          invoice: makeInvoice({ status: 'paid', settlement: 'paid', paid_cents: 15000, balance_cents: 0 }),
          payment: makePayment(),
          receipt,
        },
        'GET /receipts/:id/pdf': () => reply(200, new Blob(['%PDF'], { type: 'application/pdf' })),
      }),
    );
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);
    await addByKeyboard(user, search, 'Hemograma');
    await screen.findByText('Listo para cobrar');

    await user.keyboard('{F4}');
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar cobro' });
    const received = within(dialog).getByLabelText('Efectivo recibido');
    await user.type(received, '100');
    expect(within(dialog).getByText('El monto recibido es menor que el total a cobrar.')).toBeInTheDocument();
    await user.clear(received);
    await user.type(received, '200');
    expect(within(dialog).getByTestId('payment-change')).toHaveTextContent('L 50.00');

    await user.click(within(dialog).getByRole('button', { name: /Confirmar cobro · L 150\.00/ }));

    expect(await screen.findByRole('heading', { name: 'Operación cobrada' })).toBeInTheDocument();
    expect(screen.getByText(invoice.number)).toBeInTheDocument();
    expect(screen.getByText('L 50.00')).toBeInTheDocument();

    const [inv] = api.calls('POST /invoices');
    const [pay] = api.calls('POST /invoices/:id/payments');
    expect(inv?.headers['idempotency-key']).toBeTruthy();
    expect(inv?.body).toEqual({
      items: [{ service_id: hemograma.id, quantity_hundredths: 100 }],
      dialysis_prescription: false,
      patient_name: 'María López',
    });
    expect(pay?.path).toBe('/api/invoices/5/payments');
    expect(pay?.headers['idempotency-key']).toBeTruthy();
    expect(pay?.headers['idempotency-key']).not.toBe(inv?.headers['idempotency-key']);
    expect(pay?.body).toEqual({ method: 'cash', amount_cents: 15000, received_cents: 20000 });

    // Print opens the receipt PDF in a new tab.
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    URL.createObjectURL = vi.fn(() => 'blob:recibo');
    URL.revokeObjectURL = vi.fn();
    await user.click(screen.getByRole('button', { name: 'Imprimir recibo' }));
    await waitFor(() => expect(api.calls('GET /receipts/:id/pdf')[0]?.path).toBe('/api/receipts/70/pdf'));
    await waitFor(() => expect(tab.location.href).toBe('blob:recibo'));

    // Nueva operación resets everything and focuses the patient.
    await user.click(screen.getByRole('button', { name: /Nueva operación/ }));
    const patient = await screen.findByLabelText(/Nombre del paciente/);
    expect(patient).toHaveValue('');
    await waitFor(() => expect(patient).toHaveFocus());
  });

  it('payment failure leaves "Emitido pendiente de cobro" and "Cobrar pendiente" retries with the same key', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const api = mockApi(
      baseRoutes({
        'POST /invoices': reply(201, makeInvoice()),
        'POST /invoices/:id/payments': () => {
          attempt += 1;
          if (attempt === 1) return apiError(503, 'unavailable', 'No hay conexión con el servidor.');
          return {
            invoice: makeInvoice({ status: 'paid', settlement: 'paid', paid_cents: 15000, balance_cents: 0 }),
            payment: makePayment({ received_cents: null, change_cents: 0 }),
            receipt: makeReceipt(),
          };
        },
      }),
    );
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const search = await start(user);
    await addByKeyboard(user, search, 'Hemograma');
    await screen.findByText('Listo para cobrar');

    await user.click(screen.getAllByRole('button', { name: /Cobrar · L 150\.00/ })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar cobro' });
    await user.click(within(dialog).getByRole('button', { name: /Confirmar cobro/ }));

    expect(await screen.findByRole('heading', { name: 'Emitido pendiente de cobro' })).toBeInTheDocument();
    expect(screen.getAllByText('No hay conexión con el servidor.').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Cobrar pendiente' }));
    const retry = await screen.findByRole('dialog', { name: 'Cobrar pendiente' });
    await user.click(within(retry).getByRole('button', { name: /Confirmar cobro/ }));

    expect(await screen.findByRole('heading', { name: 'Operación cobrada' })).toBeInTheDocument();
    expect(api.calls('POST /invoices')).toHaveLength(1);
    const pays = api.calls('POST /invoices/:id/payments');
    expect(pays).toHaveLength(2);
    expect(pays[0]?.headers['idempotency-key']).toBe(pays[1]?.headers['idempotency-key']);
    expect(pays[1]?.body).toEqual({ method: 'cash', amount_cents: 15000 });
  });

  it('requires the patient name before charging (F4)', async () => {
    const user = userEvent.setup();
    mockApi(baseRoutes());
    renderWithProviders(<CobrarPage />, { path: '/cobrar' });
    const patient = await screen.findByLabelText(/Nombre del paciente/);
    await user.click(screen.getByRole('combobox', { name: 'Buscar concepto' }));
    await addByKeyboard(user, screen.getByRole('combobox', { name: 'Buscar concepto' }), 'Hemograma');
    await screen.findByText('Listo para cobrar');
    await user.keyboard('{F4}');
    expect(await screen.findByText('Ingrese el nombre del paciente.')).toBeInTheDocument();
    expect(patient).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
