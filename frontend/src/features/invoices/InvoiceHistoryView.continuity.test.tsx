import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, institutionalReceipts, type AuthUser, type Invoice } from '../../lib/api';
import { InvoiceHistoryView } from './InvoiceHistoryView';

vi.mock('../../lib/download', async () => {
  const actual = await vi.importActual<typeof import('../../lib/download')>('../../lib/download');
  return { ...actual, openBlobInNewTab: vi.fn(), downloadBlob: vi.fn() };
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Ubicacion actual">{`${location.pathname}${location.search}`}</output>;
}

function HistoryNavigation() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate('/invoices?status=issued&invoice=71')}>Ir a factura 71</button>
      <button type="button" onClick={() => navigate('/invoices?status=issued&invoice=72')}>Ir a factura 72</button>
      <button type="button" onClick={() => navigate('/invoices?status=issued')}>Cerrar enlace de factura</button>
    </div>
  );
}

function renderHistory(initialEntry: string, user = historyUser()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <InvoiceHistoryView user={user} onStatus={vi.fn()} />
        <LocationProbe />
        <HistoryNavigation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function findDialogByTitle(title: RegExp) {
  const titleElement = await screen.findByText(title);
  const dialog = titleElement.closest<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  return dialog as HTMLElement;
}

describe('InvoiceHistoryView continuity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserva filtros URL al abrir y cerrar el detalle accesible', async () => {
    const summary = invoiceFixture({ items: [] });
    const detail = invoiceFixture({
      items: [{
        id: 91,
        service_id: 7,
        service_name: 'Hemograma completo al emitir',
        category_id: 2,
        category_name: 'Laboratorio historico',
        area_id: 3,
        area_name: 'Laboratorio',
        quantity: '1.00',
        unit_price: '275.00',
        tax_rate: '0.00',
        tax_amount: '0.00',
        line_subtotal: '275.00',
        line_total: '275.00',
        special_rule_code: null,
        special_rule_applied: false,
        notes: null,
      }],
    });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [summary],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(detail);

    renderHistory('/invoices?status=issued&q=Ana');

    await waitFor(() => {
      expect(apiClient.getInvoices).toHaveBeenCalledWith(expect.objectContaining({ status: 'issued', patient: 'Ana' }));
    });
    const detailTrigger = await screen.findByRole('button', { name: /ver detalle de la factura 000-001-01-00000071/i });
    fireEvent.click(detailTrigger);

    expect(await screen.findByRole('dialog', { name: /factura 000-001-01-00000071/i })).toBeInTheDocument();
    expect(screen.getByText('Hemograma completo al emitir')).toBeInTheDocument();
    expect(screen.getByText(/10\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('status=issued');
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('q=Ana');
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar panel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /ver detalle de la factura 000-001-01-00000071/i })).toHaveFocus());
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('/invoices?status=issued&q=Ana');
    expect(screen.getByLabelText(/paciente/i)).toHaveValue('Ana');
  });

  it('mantiene las acciones del detalle gobernadas por invoiceActionPolicy', async () => {
    const paid = invoiceFixture({
      status: 'paid',
      paid_amount: '275.00',
      balance_due: '0.00',
      institutional_receipt: {
        id: 14,
        receipt_number_full: 'REC-A-00000014',
        status: 'issued',
        issued_at: '2026-07-10T14:35:00.000000Z',
        reprint_count: 0,
        print_events_count: 0,
        has_print_events: false,
      },
    });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [paid],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);

    renderHistory('/invoices', historyAdministrator());

    fireEvent.click(await screen.findByRole('button', { name: /ver detalle de la factura 000-001-01-00000071/i }));
    const detail = await screen.findByRole('dialog', { name: /factura 000-001-01-00000071/i });

    expect(detail).toHaveTextContent('Acciones autorizadas');
    expect(screen.getByRole('button', { name: /ver recibo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^descargar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reimprimir$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reversar pago/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular factura|eliminar/i })).not.toBeInTheDocument();
  });

  it('abre el enlace invoice proveniente de caja sin perder los filtros', async () => {
    const invoice = invoiceFixture();
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [invoice],
      meta: { current_page: 1, per_page: 10, total: 1 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);

    renderHistory('/invoices?status=issued&q=Ana&invoice=71');

    expect(await screen.findByRole('dialog', { name: /factura 000-001-01-00000071/i })).toBeInTheDocument();
    expect(apiClient.getInvoice).toHaveBeenCalledWith(71);
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('status=issued');
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('q=Ana');
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('invoice=71');
  });

  it('ignora un invoice ID invalido sin abrir un panel ni ejecutar acciones', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });
    const getInvoice = vi.spyOn(apiClient, 'getInvoice');

    renderHistory('/invoices?invoice=no-valido');

    await waitFor(() => expect(apiClient.getInvoices).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getInvoice).not.toHaveBeenCalled();
    expect(screen.queryByText('Acciones autorizadas')).not.toBeInTheDocument();
  });

  it('muestra error sin acciones cuando la factura enlazada ya no existe', async () => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 10, total: 0 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockRejectedValue(new Error('Factura no encontrada'));

    renderHistory('/invoices?invoice=404');

    expect(await screen.findByRole('dialog', { name: /^factura$/i })).toBeInTheDocument();
    expect(await screen.findByText('Factura no encontrada')).toBeInTheDocument();
    expect(screen.queryByText('Acciones autorizadas')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular|reversar|reimprimir|descargar/i })).not.toBeInTheDocument();
  });

  it('descarta una respuesta vieja cuando el deep-link cambia durante la carga', async () => {
    const first = invoiceFixture({ id: 71, patient_name: 'Paciente anterior' });
    const second = invoiceFixture({ id: 72, invoice_number: '000-001-01-00000072', patient_name: 'Paciente vigente' });
    let resolveFirst!: (invoice: Invoice) => void;
    let resolveSecond!: (invoice: Invoice) => void;
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({
      data: [first, second],
      meta: { current_page: 1, per_page: 10, total: 2 },
    });
    vi.spyOn(apiClient, 'getInvoice').mockImplementation((id) => new Promise((resolve) => {
      if (id === 71) resolveFirst = resolve;
      if (id === 72) resolveSecond = resolve;
    }));

    renderHistory('/invoices?status=issued&invoice=71');
    await waitFor(() => expect(apiClient.getInvoice).toHaveBeenCalledWith(71));
    fireEvent.click(screen.getByText('Ir a factura 72'));
    await waitFor(() => expect(apiClient.getInvoice).toHaveBeenCalledWith(72));

    await act(async () => resolveFirst(first));
    expect(within(screen.getByRole('dialog')).queryByText('Paciente anterior')).not.toBeInTheDocument();
    await act(async () => resolveSecond(second));

    expect(await screen.findByRole('dialog', { name: /000-001-01-00000072/ })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Paciente vigente')).toBeInTheDocument();
  });

  it('sincroniza el detalle después de anular y elimina acciones obsoletas', async () => {
    const issued = invoiceFixture();
    const voided = invoiceFixture({ status: 'void', void_reason: 'Registro duplicado' });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [issued], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(issued);
    vi.spyOn(apiClient, 'voidInvoice').mockResolvedValue(voided);
    renderHistory('/invoices?invoice=71', historyAdministrator());

    fireEvent.click(await screen.findByRole('button', { name: /anular factura/i }));
    fireEvent.change(await screen.findByLabelText(/motivo de anulaci/i), { target: { value: 'Registro duplicado' } });
    const confirmation = await findDialogByTitle(/anular factura 000-001-01-00000071/i);
    fireEvent.click(within(confirmation).getByRole('button', { name: /anular factura/i }));

    await waitFor(() => expect(apiClient.voidInvoice).toHaveBeenCalled());
    expect(await screen.findByText('Anulada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular factura/i })).not.toBeInTheDocument();
  });

  it('sincroniza el detalle después de reversar y elimina acciones obsoletas', async () => {
    const paid = invoiceFixture({ status: 'paid', paid_amount: '275.00', balance_due: '0.00' });
    const reversed = invoiceFixture({ status: 'void', paid_amount: '0.00', balance_due: '275.00', void_reason: 'Pago equivocado' });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [paid], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(paid);
    vi.spyOn(apiClient, 'reverseInvoice').mockResolvedValue(reversed);
    renderHistory('/invoices?invoice=71', historyAdministrator());

    fireEvent.click(await screen.findByRole('button', { name: /reversar pago/i }));
    fireEvent.change(await screen.findByLabelText(/motivo de reversa/i), { target: { value: 'Pago aplicado a otra factura' } });
    const confirmation = await findDialogByTitle(/reversar factura 000-001-01-00000071/i);
    fireEvent.click(within(confirmation).getByRole('button', { name: /reversar factura/i }));

    await waitFor(() => expect(apiClient.reverseInvoice).toHaveBeenCalled());
    expect(await screen.findByText('Anulada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reversar pago/i })).not.toBeInTheDocument();
  });

  it('sincroniza el recibo recién generado y retira Generar PDF', async () => {
    const paid = invoiceFixture({ status: 'paid', paid_amount: '275.00', balance_due: '0.00', institutional_receipt: null });
    const withReceipt = invoiceFixture({
      status: 'paid', paid_amount: '275.00', balance_due: '0.00',
      institutional_receipt: { id: 14, receipt_number_full: 'REC-A-00000014', status: 'issued', issued_at: '2026-07-10T14:35:00Z', reprint_count: 0, print_events_count: 0, has_print_events: false },
    });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [paid], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice')
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(withReceipt);
    vi.spyOn(institutionalReceipts, 'store').mockResolvedValue({ id: 14, receipt_number_full: 'REC-A-00000014' } as never);
    vi.spyOn(apiClient, 'getInstitutionalReceiptPdf').mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    vi.spyOn(apiClient, 'registerInstitutionalReceiptPrintEvent').mockResolvedValue({} as never);
    renderHistory('/invoices?invoice=71', historyAdministrator());

    fireEvent.click(await screen.findByRole('button', { name: /generar pdf/i }));

    await waitFor(() => expect(institutionalReceipts.store).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: /generar pdf/i })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /ver recibo|reimprimir pdf/i })).toBeInTheDocument();
  });

  it('presenta pagos registrados y anulados con fecha y caja sin sumarlos como vigentes', async () => {
    const detail = invoiceFixture({
      status: 'paid', paid_amount: '200.00', balance_due: '75.00',
      payments: [
        { id: 1, invoice_id: 71, cash_session_id: 12, user_id: 8, method: 'cash', amount: '200.00', reference: null, status: 'posted', paid_at: '2026-07-10T14:35:00Z' },
        { id: 2, invoice_id: 71, cash_session_id: 13, user_id: 8, method: 'card', amount: '75.00', reference: 'POS-81', status: 'void', paid_at: '2026-07-10T14:40:00Z', void_reason: 'Cobro duplicado' },
      ],
    });
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [detail], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(detail);
    renderHistory('/invoices?invoice=71');

    expect(await screen.findByText('Pago registrado')).toBeInTheDocument();
    expect(screen.getByText('Pago anulado')).toBeInTheDocument();
    expect(screen.getByText(/Caja #12/)).toBeInTheDocument();
    expect(screen.getByText(/Caja #13/)).toBeInTheDocument();
    expect(screen.getByLabelText('Monto anulado L 75.00')).toBeInTheDocument();
  });

  it('devuelve foco al historial al cerrar un deep-link sin disparador', async () => {
    const invoice = invoiceFixture();
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [invoice], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);
    renderHistory('/invoices?invoice=71');

    fireEvent.click(await screen.findByRole('button', { name: /cerrar panel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Historial de facturas')).toHaveFocus());
  });

  it.each([
    {
      actionName: /anular factura/i,
      modalName: /anular factura 000-001-01-00000071/i,
      invoice: invoiceFixture(),
    },
    {
      actionName: /reversar pago/i,
      modalName: /reversar factura 000-001-01-00000071/i,
      invoice: invoiceFixture({ status: 'paid', paid_amount: '275.00', balance_due: '0.00' }),
    },
  ])('conserva detalle y factura al cancelar $actionName', async ({ actionName, modalName, invoice }) => {
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [invoice], meta: { current_page: 1, per_page: 10, total: 1 } });
    vi.spyOn(apiClient, 'getInvoice').mockResolvedValue(invoice);
    renderHistory('/invoices?invoice=71', historyAdministrator());

    const detail = await screen.findByRole('dialog', { name: /factura 000-001-01-00000071/i });
    const actionTrigger = within(detail).getByRole('button', { name: actionName });
    fireEvent.click(actionTrigger);

    const confirmation = await findDialogByTitle(modalName);
    expect(detail).toBeInTheDocument();
    expect(detail).toHaveTextContent('Ana Lopez');

    fireEvent.click(within(confirmation).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByText(modalName)).not.toBeInTheDocument());
    expect(detail).toBeInTheDocument();
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('invoice=71');
  });

  it('expone el contrato semántico del grid sin afirmar clases de implementación visual', async () => {
    const invoice = invoiceFixture();
    vi.spyOn(apiClient, 'getInvoices').mockResolvedValue({ data: [invoice], meta: { current_page: 1, per_page: 10, total: 1 } });
    renderHistory('/invoices');

    expect(await screen.findByRole('region', { name: /tabla de facturas/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /facturas filtradas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver detalle de la factura/i })).toBeEnabled();
  });
});

function invoiceFixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 71,
    invoice_number: '000-001-01-00000071',
    patient_name: 'Ana Lopez',
    subtotal: '275.00',
    tax_amount: '0.00',
    discount_amount: '0.00',
    total: '275.00',
    paid_amount: '0.00',
    balance_due: '275.00',
    status: 'issued',
    issued_at: '2026-07-10T14:30:00.000000Z',
    items: [],
    issuer: { id: 8, name: 'Caja Hospital', username: 'caja' },
    ...overrides,
  };
}

function historyUser(): AuthUser {
  return {
    id: 8,
    name: 'Caja Hospital',
    email: 'caja@hospital.local',
    username: 'caja',
    active: true,
    roles: ['cashier'],
    permissions: ['invoices.view'],
    must_change_password: false,
  };
}

function historyAdministrator(): AuthUser {
  return {
    ...historyUser(),
    roles: ['admin'],
    permissions: [
      'invoices.view',
      'invoices.operate_any',
      'invoices.void',
      'invoices.reverse',
      'receipts.view',
      'receipts.reprint',
      'receipts.reprint_any',
      'payments.create',
    ],
  };
}
