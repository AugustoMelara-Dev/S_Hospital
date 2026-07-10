import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, type AuthUser, type Invoice } from '../../lib/api';
import { InvoiceHistoryView } from './InvoiceHistoryView';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Ubicacion actual">{`${location.pathname}${location.search}`}</output>;
}

function renderHistory(initialEntry: string, user = historyUser()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <InvoiceHistoryView user={user} onStatus={vi.fn()} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle de la factura 000-001-01-00000071/i }));

    expect(await screen.findByRole('dialog', { name: /factura 000-001-01-00000071/i })).toBeInTheDocument();
    expect(screen.getByText('Hemograma completo al emitir')).toBeInTheDocument();
    expect(screen.getByText(/10\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('status=issued');
    expect(screen.getByLabelText('Ubicacion actual')).toHaveTextContent('q=Ana');
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar panel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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
