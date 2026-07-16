import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceSuccess } from './InvoiceSuccess';

describe('InvoiceSuccess', () => {
  it('presenta factura pagada como resultado persistente', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000008"
          patientName="Paciente Prueba"
          total="125.00"
          status="paid"
          canPrintReceipt
          canSavePdf
          paymentMethod="cash"
          paymentDate="2026-07-10T09:30:00-06:00"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onGuardarPdf={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: 'Factura pagada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir recibo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Nueva factura' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Ir al historial' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText(/10\/07\/2026/)).toBeInTheDocument();
  });

  it('uses pending language for an issued invoice and never calls it paid', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000013"
          patientName="Paciente Pendiente"
          total="125.00"
          status="issued"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: 'Factura pendiente' })).toBeInTheDocument();
    expect(screen.queryByText(/factura pagada/i)).not.toBeInTheDocument();
  });

  it.each(['partial', 'issued'] as const)('shows existing payment metadata for a %s invoice', (status) => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000014"
          patientName="Paciente con abono"
          total="125.00"
          status={status}
          paymentMethod="card"
          paymentDate="2026-07-10T10:45:00-06:00"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText(/10\/07\/2026/)).toBeInTheDocument();
  });

  it('renders malformed totals as safe financial labels', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000001"
          patientName="Paciente Prueba"
          total="monto-danado"
          status="issued"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('000-001-01-00000001')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('keeps paid success actions to print, new invoice and detail only', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000009"
          patientName="Paciente Prueba"
          total="125.00"
          status="paid"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /imprimir/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver recibo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al historial/i })).toHaveAttribute('href', '/invoices');
  });

  it('uses a paid success title when the invoice is already collected', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000010"
          patientName="Paciente Pagado"
          total="125.00"
          status="paid"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /factura emitida exitosamente/i })).not.toBeInTheDocument();
    expect(screen.getByText(/recibo listo para imprimir/i)).toBeInTheDocument();
  });

  it('does not promise printing when a paid invoice cannot print receipts', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000011"
          patientName="Paciente Sin Permiso"
          total="125.00"
          status="paid"
          canPrintReceipt={false}
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: /factura pagada/i })).toBeInTheDocument();
    expect(screen.queryByText(/recibo listo para imprimir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/la factura ya fue emitida/i)).not.toBeInTheDocument();
    expect(screen.getByText(/la factura ya fue pagada/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite a caja imprimir el recibo institucional/i)).toBeInTheDocument();
  });

  it('prioritizes history recovery when a paid invoice has a pending institutional receipt', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000012"
          patientName="Paciente Pendiente"
          total="125.00"
          status="paid"
          canPrintReceipt={false}
          receiptRecoveryMessage="Pago registrado, pero no se pudo emitir el recibo institucional. Genere el recibo institucional desde Historial antes de entregar comprobante."
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/pago registrado, pero no se pudo emitir el recibo institucional/i)).toHaveLength(1);
    expect(screen.getByRole('link', { name: /resolver recibo en historial/i })).toHaveAttribute(
      'href',
      '/invoices?invoice_number=000-001-01-00000012',
    );
    expect(screen.getByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imprimir recibo institucional/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^ver detalle$/i })).not.toBeInTheDocument();
  });

  it('keeps received cash and change visible after completing payment', () => {
    render(
      <MemoryRouter>
        <InvoiceSuccess
          open
          onOpenChange={vi.fn()}
          invoiceNumber="000-001-01-00000020"
          patientName="Paciente Cambio"
          total="17.25"
          status="paid"
          paymentMethod="cash"
          receivedAmount="50.00"
          changeAmount="32.75"
          onCobrar={vi.fn()}
          onImprimir={vi.fn()}
          onNuevaFactura={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Monto recibido')).toBeInTheDocument();
    expect(screen.getByText('L 50.00')).toBeInTheDocument();
    expect(screen.getByText('Cambio')).toBeInTheDocument();
    expect(screen.getByText('L 32.75')).toBeInTheDocument();
  });
});
