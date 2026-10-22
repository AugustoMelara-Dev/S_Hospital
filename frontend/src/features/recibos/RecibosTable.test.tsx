import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Invoice } from '@/lib/api';
import { RecibosTable, type RecibosBasePermissions } from './RecibosTable';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 10,
    invoice_number: '000-001-01-00000010',
    patient_name: 'Paciente Visible',
    subtotal: '100.00',
    tax_amount: '15.00',
    discount_amount: '0.00',
    total: '115.00',
    paid_amount: '115.00',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T12:00:00.000000Z',
    items: [],
    ...overrides,
  };
}

function permissions(overrides: Partial<RecibosBasePermissions> = {}): RecibosBasePermissions {
  return {
    canCollectPayment: false,
    canIssueInstitutionalReceipt: false,
    canOperateAnyInvoice: true,
    canReprint: false,
    canReprintAny: false,
    canReverse: false,
    canViewReceipt: true,
    canVoid: false,
    ...overrides,
  };
}

function renderTable(overrides: Partial<ComponentProps<typeof RecibosTable>> = {}) {
  const handlers = {
    onOpenDetail: vi.fn(),
    onOpenReceipt: vi.fn(),
    onGenerateReceipt: vi.fn(),
    onReprint: vi.fn(),
    onCollect: vi.fn(),
  };
  render(
    <RecibosTable
      invoices={[invoice()]}
      loadingActionInvoiceId={null}
      permissions={permissions()}
      isOwnInvoiceFromToday={() => false}
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

/** La tabla de escritorio sigue siendo la misma que antes de las tarjetas móviles. */
function desktopTable() {
  return within(screen.getByRole('table', { name: /operaciones filtradas/i }));
}

/** La lista móvil duplica la operación como tarjeta apilada (visible bajo `md`). */
function mobileList() {
  return within(screen.getByRole('list', { name: /operaciones en móvil/i }));
}

describe('RecibosTable', () => {
  it('muestra el tipo real de documento y el estado de pago textual', () => {
    render(
      <RecibosTable
        invoices={[
          invoice({
            institutional_receipt: {
              id: 90,
              receipt_number_full: 'REC-A-00000090',
              status: 'issued',
              issued_at: '2026-09-18T12:05:00.000000Z',
              reprint_count: 0,
              copy_mode: 'original_only',
            },
          }),
        ]}
        loadingActionInvoiceId={null}
        permissions={permissions()}
        isOwnInvoiceFromToday={() => false}
        onOpenDetail={vi.fn()}
        onOpenReceipt={vi.fn()}
        onGenerateReceipt={vi.fn()}
        onReprint={vi.fn()}
        onCollect={vi.fn()}
      />,
    );

    expect(desktopTable().getByText('Comprobante institucional')).toBeInTheDocument();
    expect(desktopTable().getByText('REC-A-00000090')).toBeInTheDocument();
    expect(desktopTable().getByText('Cobrada')).toBeInTheDocument();
  });

  it('ofrece la acción principal por fila y el detalle en el menú accesible', async () => {
    const user = userEvent.setup();
    const handlers = renderTable();

    // Con comprobante visible, «Ver recibo» es la acción principal directa.
    fireEvent.click(desktopTable().getByRole('button', { name: /Ver recibo/ }));
    expect(handlers.onOpenReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));

    // «Detalle» vive en el menú «⋯», no compite con la acción principal.
    await user.click(desktopTable().getByRole('button', { name: /más acciones de la operación/i }));
    const detalle = await screen.findByRole('menuitem', { name: /^Detalle$/ });
    fireEvent.click(detalle);
    // El componente difiere la acción (RecibosTable.tsx): onSelect la encola y la
    // ejecuta tras onCloseAutoFocus + queueMicrotask (patrón cierre-antes-de-abrir).
    // En jsdom eso solo se observa esperando async (precedente: useUnsavedChangesGuard).
    await waitFor(() => expect(handlers.onOpenDetail).toHaveBeenCalled());
  });

  it('muestra reimprimir como acción principal cuando hay comprobante y permiso, aunque no pueda verlo', () => {
    renderTable({
      permissions: permissions({ canViewReceipt: false, canReprint: true, canReprintAny: true }),
    });

    expect(desktopTable().getByRole('button', { name: /^reimprimir$/i })).toBeInTheDocument();
    expect(desktopTable().queryByRole('button', { name: /Ver recibo/ })).not.toBeInTheDocument();
  });

  it('etiqueta la emisión sin cobro como tal y nunca como pago', () => {
    renderTable({
      invoices: [invoice({ status: 'paid', total: '0.00', paid_amount: '0.00', balance_due: '0.00' })],
    });

    expect(desktopTable().getByText('Emitida sin cobro')).toBeInTheDocument();
  });

  it('ordena por total con encabezado accesible y respeta el orden pedido', () => {
    renderTable({
      invoices: [
        invoice({ id: 10, invoice_number: 'A-10', patient_name: 'Paciente Alto', total: '115.00' }),
        invoice({ id: 11, invoice_number: 'A-11', patient_name: 'Paciente Bajo', total: '20.00' }),
      ],
    });

    const totalHeader = screen.getByRole('columnheader', { name: /total/i });
    expect(totalHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(totalHeader).getByRole('button', { name: /total/i }));
    expect(totalHeader).toHaveAttribute('aria-sort', 'ascending');

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(within(dataRows[0]).getByText('Paciente Bajo')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Paciente Alto')).toBeInTheDocument();
  });

  it('repite la operación como tarjeta móvil con documento, paciente, fecha, total y estado', () => {
    renderTable({
      invoices: [
        invoice({
          id: 12,
          invoice_number: 'A-12',
          patient_name: 'Ana Cardona',
          total: '250.00',
          status: 'issued',
          issued_at: '2026-09-18T15:30:00.000000Z',
          institutional_receipt: {
            id: 91,
            receipt_number_full: 'REC-A-00000091',
            status: 'issued',
            issued_at: '2026-09-18T15:35:00.000000Z',
            reprint_count: 0,
            copy_mode: 'original_only',
          },
        }),
      ],
    });

    const card = mobileList().getAllByRole('listitem')[0];
    expect(card).toHaveTextContent('A-12');
    expect(card).toHaveTextContent('Ana Cardona');
    expect(card).toHaveTextContent('L. 250.00');
    expect(card).toHaveTextContent('Pendiente de cobro');
    expect(card).toHaveTextContent('REC-A-00000091');
    expect(within(card).getByText('Paciente')).toBeInTheDocument();
    expect(within(card).getByText('Fecha')).toBeInTheDocument();
    expect(within(card).getByText('Total')).toBeInTheDocument();
  });

  it('la tarjeta móvil ofrece Detalle y Cobrar con las mismas acciones autorizadas', () => {
    const handlers = renderTable({
      invoices: [invoice({ status: 'issued', paid_amount: '0.00', balance_due: '115.00' })],
      permissions: permissions({ canCollectPayment: true, canOperateAnyInvoice: true }),
    });

    const card = mobileList().getAllByRole('listitem')[0];
    fireEvent.click(within(card).getByRole('button', { name: /^Detalle$/ }));
    expect(handlers.onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), expect.anything());

    fireEvent.click(within(card).getByRole('button', { name: /^Cobrar$/ }));
    expect(handlers.onCollect).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it('mantiene en móvil el orden elegido porque comparte el estado de la tabla', () => {
    renderTable({
      invoices: [
        invoice({ id: 10, invoice_number: 'A-10', patient_name: 'Paciente Alto', total: '115.00' }),
        invoice({ id: 11, invoice_number: 'A-11', patient_name: 'Paciente Bajo', total: '20.00' }),
      ],
    });

    const mobileOrder = screen.getByLabelText(/ordenar por/i);
    fireEvent.change(mobileOrder, { target: { value: 'total:asc' } });

    expect(mobileList().getAllByRole('listitem')[0]).toHaveTextContent('A-11');
    expect(mobileList().getAllByRole('listitem')[1]).toHaveTextContent('A-10');

    // El mismo estado mueve la tabla de escritorio.
    expect(screen.getByRole('columnheader', { name: /total/i })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('usa objetivos táctiles de 44 px en las acciones de la tarjeta móvil', () => {
    renderTable({
      permissions: permissions({ canReprint: true, canReprintAny: true, canViewReceipt: false }),
    });

    const card = mobileList().getAllByRole('listitem')[0];
    expect(within(card).getByRole('button', { name: /^Detalle$/ })).toHaveClass('min-h-11');
    expect(within(card).getByRole('button', { name: /reimprimir comprobante/i })).toHaveClass('size-11');
  });

  it('separa el estado documental del financiero en la misma fila', () => {
    renderTable({
      invoices: [invoice({ status: 'paid', paid_amount: '115.00', institutional_receipt: null })],
    });

    // Cobro registrado sin PDF: el documento está pendiente aunque el cobro exista.
    expect(desktopTable().getByText('Comprobante pendiente')).toBeInTheDocument();
    expect(desktopTable().getByText('Cobrada')).toBeInTheDocument();
  });

  it('marca la fila abierta en el detalle y expone la acción principal con su clave', () => {
    renderTable({
      invoices: [invoice({ status: 'issued', paid_amount: '0.00', balance_due: '115.00' })],
      permissions: permissions({ canCollectPayment: true, canOperateAnyInvoice: true }),
      selectedInvoiceId: 10,
    });

    const dataRow = screen.getAllByRole('row')[1];
    expect(dataRow).toHaveClass('bg-[var(--ui-action-subtle)]');

    const primary = desktopTable().getByRole('button', { name: /^Cobrar$/ });
    expect(primary).toHaveAttribute('data-row-primary-action', 'collect');
  });

  it('lleva el foco y el detalle al número de documento con su disparador estable', () => {
    renderTable();

    const trigger = desktopTable().getByRole('button', { name: /ver detalle de la operación/i });
    expect(trigger).toHaveAttribute('data-invoice-detail-trigger', '10');
  });
});
