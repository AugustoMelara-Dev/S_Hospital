import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, makeMe, mockApi, reply, type MockRequest } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import { cajero, makeDetail, makeInvoice, makePayment, makeReceipt } from '@/features/cobrar/testFixtures';
import RecibosPage from './RecibosPage';
import { ReciboDetalle } from './ReciboDetallePage';

const supervisor = makeMe({ role: { code: 'supervisor', name: 'Supervisión' } });

describe('Recibos (lista)', () => {
  it('reads filters from the URL and sends them to GET /invoices', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /auth/me': cajero,
      'GET /invoices': ({ query }: MockRequest) => ({
        items: [makeInvoice({ patient_name: `Juan ${query.get('page') ?? '1'}` })],
        page: Number(query.get('page') ?? 1),
        per_page: 25,
        total: 60,
      }),
    });
    renderWithProviders(<RecibosPage />, { path: '/recibos?search=Juan&status=pending' });

    expect(await screen.findByLabelText('Paciente o número')).toHaveValue('Juan');
    const table = await screen.findByRole('table', { name: 'Facturas y recibos' });
    expect(await within(table).findByText('Juan 1')).toBeInTheDocument();
    expect(within(table).getByText('000-001-01-00000012')).toBeInTheDocument();
    expect(within(table).getByText('Pendiente de cobro')).toBeInTheDocument();

    const first = api.calls('GET /invoices')[0]!;
    expect(first.query.get('search')).toBe('Juan');
    expect(first.query.get('status')).toBe('issued');
    expect(first.query.get('pending')).toBeNull();

    await user.click(screen.getByLabelText('Solo con saldo pendiente'));
    await waitFor(() => expect(api.calls('GET /invoices').at(-1)?.query.get('pending')).toBe('1'));

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(api.calls('GET /invoices').at(-1)?.query.get('page')).toBe('2'));
    expect(api.calls('GET /invoices').at(-1)?.query.get('search')).toBe('Juan');
  });

  it('typing a search updates the request (debounced)', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /auth/me': cajero,
      'GET /invoices': { items: [], page: 1, per_page: 25, total: 0 },
    });
    renderWithProviders(<RecibosPage />, { path: '/recibos' });
    await user.type(await screen.findByLabelText('Paciente o número'), 'Ana');
    await waitFor(() => expect(api.calls('GET /invoices').at(-1)?.query.get('search')).toBe('Ana'));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });
});

describe('Recibos (detalle)', () => {
  it('void requires a reason ≥5 and posts it with an idempotency key', async () => {
    const user = userEvent.setup();
    let voided = false;
    const api = mockApi({
      'GET /auth/me': supervisor,
      'GET /invoices/:id': () =>
        voided
          ? makeDetail({ status: 'void', void_reason: 'Paciente duplicado', voided_at: '2026-11-17T10:00:00-06:00', actions: undefined })
          : makeDetail(),
      'POST /invoices/:id/void': () => {
        voided = true;
        return makeInvoice({ status: 'void' });
      },
    });
    renderWithProviders(<ReciboDetalle id={5} />, { path: '/recibos/5' });

    await user.click(await screen.findByRole('button', { name: 'Anular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anular factura' });
    expect(within(dialog).getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Anular factura' }));
    expect(await within(dialog).findByText('Escriba un motivo de al menos 5 caracteres.')).toBeInTheDocument();
    expect(api.calls('POST /invoices/:id/void')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Motivo de anulación/), 'Paciente duplicado');
    await user.click(within(dialog).getByRole('button', { name: 'Anular factura' }));

    await waitFor(() => expect(api.calls('POST /invoices/:id/void')).toHaveLength(1));
    const call = api.calls('POST /invoices/:id/void')[0]!;
    expect(call.body).toEqual({ reason: 'Paciente duplicado' });
    expect(call.headers['idempotency-key']).toBeTruthy();
    expect(await screen.findByText('Factura anulada.')).toBeInTheDocument();
    expect(await screen.findByText(/Motivo: Paciente duplicado/)).toBeInTheDocument();
  });

  it('shows the backend error and keeps the dialog open when void fails', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /auth/me': supervisor,
      'GET /invoices/:id': makeDetail(),
      'POST /invoices/:id/void': apiError(400, 'invoice_has_payments', 'La factura tiene pagos registrados.'),
    });
    renderWithProviders(<ReciboDetalle id={5} />);
    await user.click(await screen.findByRole('button', { name: 'Anular' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anular factura' });
    await user.type(within(dialog).getByLabelText(/Motivo de anulación/), 'Error de digitación');
    await user.click(within(dialog).getByRole('button', { name: 'Anular factura' }));
    expect(await within(dialog).findByText('La factura tiene pagos registrados.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Anular factura' })).toBeInTheDocument();
  });

  it('hides every action when the server actions are false', async () => {
    mockApi({
      'GET /auth/me': supervisor,
      'GET /invoices/:id': makeDetail({
        status: 'paid',
        settlement: 'paid',
        paid_cents: 15000,
        balance_cents: 0,
        payments: [makePayment()],
        actions: { can_pay: false, can_void: false, can_reverse: false, can_reprint: false, can_issue_receipt: false },
      }),
    });
    renderWithProviders(<ReciboDetalle id={5} />);
    expect(await screen.findByText('Hemograma completo')).toBeInTheDocument();
    for (const name of ['Anular', 'Revertir', 'Reimprimir', 'Cobrar saldo', 'Registrar abono', 'Emitir recibo']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('hides actions the user lacks permission for even if the server allows them', async () => {
    mockApi({
      'GET /auth/me': cajero,
      'GET /invoices/:id': makeDetail({
        payments: [makePayment({ amount_cents: 5000 })],
        paid_cents: 5000,
        balance_cents: 10000,
        status: 'partial',
        actions: { can_pay: true, can_void: true, can_reverse: true, can_reprint: false, can_issue_receipt: false },
      }),
    });
    renderWithProviders(<ReciboDetalle id={5} />);
    expect(await screen.findByRole('button', { name: 'Registrar abono' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revertir' })).not.toBeInTheDocument();
  });

  it('registers a partial payment (abono) with the amount typed', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /auth/me': cajero,
      'GET /invoices/:id': makeDetail(),
      'POST /invoices/:id/payments': {
        invoice: makeInvoice({ status: 'partial', paid_cents: 5000, balance_cents: 10000 }),
        payment: makePayment({ amount_cents: 5000, method: 'card', reference: 'AUT-1', received_cents: null, change_cents: null }),
        receipt: null,
      },
    });
    renderWithProviders(<ReciboDetalle id={5} />);
    await user.click(await screen.findByRole('button', { name: 'Cobrar saldo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cobrar saldo' });
    const amount = within(dialog).getByLabelText(/Monto a cobrar/);
    await user.clear(amount);
    await user.type(amount, '50');
    await user.click(within(dialog).getByRole('radio', { name: /Efectivo/ }));
    await user.keyboard('{ArrowRight}{ArrowRight}'); // Transferencia → Tarjeta
    expect(within(dialog).getByRole('radio', { name: /Tarjeta/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar cobro · L 50\.00/ }));
    expect(await within(dialog).findByText('Ingrese la referencia de la operación.')).toBeInTheDocument();
    expect(api.calls('POST /invoices/:id/payments')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Referencia/), 'AUT-1');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar cobro · L 50\.00/ }));
    await waitFor(() => expect(api.calls('POST /invoices/:id/payments')).toHaveLength(1));
    const call = api.calls('POST /invoices/:id/payments')[0]!;
    expect(call.body).toEqual({ method: 'card', amount_cents: 5000, reference: 'AUT-1' });
    expect(call.headers['idempotency-key']).toBeTruthy();
    expect(await screen.findByText('Abono registrado.')).toBeInTheDocument();
  });

  it('reprint asks for a reason and opens the returned PDF', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /auth/me': cajero,
      'GET /invoices/:id': makeDetail({
        status: 'paid',
        settlement: 'paid',
        paid_cents: 15000,
        balance_cents: 0,
        payments: [makePayment()],
        receipt: makeReceipt({ reprint_count: 1 }),
        actions: { can_pay: false, can_void: false, can_reverse: true, can_reprint: true, can_issue_receipt: false },
      }),
      'POST /receipts/:id/reprint': () => reply(200, new Blob(['%PDF'], { type: 'application/pdf' })),
    });
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    URL.createObjectURL = vi.fn(() => 'blob:reimpresion');
    URL.revokeObjectURL = vi.fn();

    renderWithProviders(<ReciboDetalle id={5} />);
    expect(await screen.findByText('REC-A-00000012')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reimprimir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reimprimir recibo' });
    expect(within(dialog).getByText('No genera cobros ni números nuevos.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Motivo de reimpresión/), 'Papel atascado');
    await user.click(within(dialog).getByRole('button', { name: 'Reimprimir' }));

    await waitFor(() => expect(tab.location.href).toBe('blob:reimpresion'));
    const call = api.calls('POST /receipts/:id/reprint')[0]!;
    expect(call.path).toBe('/api/receipts/70/reprint');
    expect(call.body).toEqual({ reason: 'Papel atascado' });
    expect(call.headers['idempotency-key']).toBeTruthy();
  });
});
