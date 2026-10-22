import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '../../../lib/api';
import { InvoiceHistoryActionDialogs } from './InvoiceHistoryActionDialogs';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleInvoice: Invoice = {
  id: 101,
  invoice_number: '000-001-01-00000101',
  patient_name: 'Juan Perez',
  subtotal: '200.00',
  tax_amount: '30.00',
  discount_amount: '0.00',
  total: '230.00',
  paid_amount: '100.00',
  balance_due: '130.00',
  status: 'partial',
  issued_at: '2026-09-18T10:00:00.000000Z',
  items: [],
  payments: [],
};

type DialogProps = ComponentProps<typeof InvoiceHistoryActionDialogs>;

function renderDialogs(overrides: Partial<DialogProps> = {}) {
  const defaultProps: DialogProps = {
    invoice: sampleInvoice,
    confirmingReprint: false,
    reprintingReceipt: false,
    onCancelReprint: vi.fn(),
    onConfirmReprint: vi.fn(),
    confirmingReceiptPrint: false,
    onCancelReceiptPrint: vi.fn(),
    onConfirmReceiptPrint: vi.fn(),
    confirmingVoid: false,
    voidingInvoice: false,
    voidReason: '',
    voidReasonError: '',
    onVoidReasonChange: vi.fn(),
    onCancelVoid: vi.fn(),
    onConfirmVoid: vi.fn(),
    confirmingReverse: false,
    reversingInvoice: false,
    reverseReason: '',
    reverseReasonError: '',
    onReverseReasonChange: vi.fn(),
    onCancelReverse: vi.fn(),
    onConfirmReverse: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<InvoiceHistoryActionDialogs {...defaultProps} />),
    props: defaultProps,
  };
}

describe('InvoiceHistoryActionDialogs — Void Dialog', () => {
  it('renders invoice details, reason textarea and disables confirm when reason < 5 chars', () => {
    renderDialogs({
      confirmingVoid: true,
      voidReason: 'abc', // 3 chars (< 5)
    });

    expect(screen.getByRole('dialog', { name: /¿anular factura 000-001-01-00000101\?/i })).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /motivo de anulación/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('abc');

    const confirmButton = screen.getByRole('button', { name: /anular factura/i });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when reason has at least 5 characters and triggers onConfirmVoid with invoice and reason', () => {
    const onConfirmVoid = vi.fn();
    renderDialogs({
      confirmingVoid: true,
      voidReason: 'Error de digitación en la cuenta',
      onConfirmVoid,
    });

    const confirmButton = screen.getByRole('button', { name: /anular factura/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirmVoid).toHaveBeenCalledTimes(1);
    expect(onConfirmVoid).toHaveBeenCalledWith(sampleInvoice, 'Error de digitación en la cuenta');
  });

  it('triggers onVoidReasonChange when typing into textarea', async () => {
    const user = userEvent.setup();
    const onVoidReasonChange = vi.fn();
    renderDialogs({
      confirmingVoid: true,
      voidReason: '',
      onVoidReasonChange,
    });

    const textarea = screen.getByRole('textbox', { name: /motivo de anulación/i });
    await user.type(textarea, 'Prueba');
    expect(onVoidReasonChange).toHaveBeenCalled();
  });

  it('triggers onCancelVoid when clicking cancel', () => {
    const onCancelVoid = vi.fn();
    renderDialogs({
      confirmingVoid: true,
      onCancelVoid,
    });

    const cancelButton = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButton);
    expect(onCancelVoid).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables actions when voidingInvoice is true', () => {
    renderDialogs({
      confirmingVoid: true,
      voidingInvoice: true,
      voidReason: 'Motivo válido para anular',
    });

    const confirmButton = screen.getByRole('button', { name: /anulando\.\.\./i });
    expect(confirmButton).toBeDisabled();

    const cancelButton = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelButton).toBeDisabled();
  });

  it('displays voidReasonError message with alert role when provided', () => {
    renderDialogs({
      confirmingVoid: true,
      voidReason: '1234',
      voidReasonError: 'El motivo debe tener al menos 5 caracteres.',
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('El motivo debe tener al menos 5 caracteres.');
  });
});

describe('InvoiceHistoryActionDialogs — Reverse Dialog', () => {
  it('renders warning about cashbox refund movement and disables confirm when reason < 5 chars', () => {
    renderDialogs({
      confirmingReverse: true,
      reverseReason: '1234', // 4 chars (< 5)
    });

    expect(screen.getByRole('dialog', { name: /¿revertir factura 000-001-01-00000101\?/i })).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();

    // Warns about cashbox refund movement
    expect(
      screen.getByText(/se cancelarán los pagos registrados y quedará constancia del motivo/i),
    ).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /motivo de reversión/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('1234');

    const confirmButton = screen.getByRole('button', { name: /revertir factura/i });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when reason has at least 5 characters and triggers onConfirmReverse with invoice and reason', () => {
    const onConfirmReverse = vi.fn();
    renderDialogs({
      confirmingReverse: true,
      reverseReason: 'Paciente canceló el servicio y solicitó devolución',
      onConfirmReverse,
    });

    const confirmButton = screen.getByRole('button', { name: /revertir factura/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirmReverse).toHaveBeenCalledTimes(1);
    expect(onConfirmReverse).toHaveBeenCalledWith(
      sampleInvoice,
      'Paciente canceló el servicio y solicitó devolución',
    );
  });

  it('triggers onReverseReasonChange when typing into textarea', async () => {
    const user = userEvent.setup();
    const onReverseReasonChange = vi.fn();
    renderDialogs({
      confirmingReverse: true,
      reverseReason: '',
      onReverseReasonChange,
    });

    const textarea = screen.getByRole('textbox', { name: /motivo de reversión/i });
    await user.type(textarea, 'Devol');
    expect(onReverseReasonChange).toHaveBeenCalled();
  });

  it('triggers onCancelReverse when clicking cancel', () => {
    const onCancelReverse = vi.fn();
    renderDialogs({
      confirmingReverse: true,
      onCancelReverse,
    });

    const cancelButton = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButton);
    expect(onCancelReverse).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables actions when reversingInvoice is true', () => {
    renderDialogs({
      confirmingReverse: true,
      reversingInvoice: true,
      reverseReason: 'Motivo válido de reversa',
    });

    const confirmButton = screen.getByRole('button', { name: /revirtiendo\.\.\./i });
    expect(confirmButton).toBeDisabled();

    const cancelButton = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelButton).toBeDisabled();
  });

  it('displays reverseReasonError message with alert role when provided', () => {
    renderDialogs({
      confirmingReverse: true,
      reverseReason: 'abc',
      reverseReasonError: 'El motivo de reversión debe tener al menos 5 caracteres.',
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('El motivo de reversión debe tener al menos 5 caracteres.');
  });
});

describe('InvoiceHistoryActionDialogs — Payment Collection Dialog', () => {
  it('renders balance display, invoice number and patient name', () => {
    renderDialogs({
      confirmingPayment: true,
      collectionAmount: '130.00',
      collectionMethod: 'cash',
    });

    expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    expect(screen.getByText('000-001-01-00000101')).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getAllByText(/130\.00/).length).toBeGreaterThan(0);
  });

  it('allows payment method selection and calls onPaymentMethodChange', () => {
    const onPaymentMethodChange = vi.fn();
    renderDialogs({
      confirmingPayment: true,
      collectionMethod: 'cash',
      onPaymentMethodChange,
    });

    const cardButton = screen.getByRole('radio', { name: /tarjeta/i });
    fireEvent.click(cardButton);
    expect(onPaymentMethodChange).toHaveBeenCalledWith('card');
  });

  it('allows editing payment amount and calls onPaymentAmountChange', () => {
    const onPaymentAmountChange = vi.fn();
    renderDialogs({
      confirmingPayment: true,
      collectionAmount: '130.00',
      onPaymentAmountChange,
    });

    const amountInput = screen.getByLabelText(/monto recibido/i);
    fireEvent.change(amountInput, { target: { value: '50.00' } });
    expect(onPaymentAmountChange).toHaveBeenCalledWith('50.00');
  });

  it('calls onConfirmPayment with amount when submitting payment', () => {
    const onConfirmPayment = vi.fn();
    renderDialogs({
      confirmingPayment: true,
      collectionAmount: '130.00',
      collectionMethod: 'cash',
      onConfirmPayment,
    });

    const confirmButton = screen.getByRole('button', { name: /confirmar cobro|cobrar/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirmPayment).toHaveBeenCalledTimes(1);
    expect(onConfirmPayment).toHaveBeenCalledWith('130.00');
  });

  it('disables submit button when collectingPayment is true', () => {
    renderDialogs({
      confirmingPayment: true,
      collectingPayment: true,
      collectionAmount: '130.00',
    });

    const confirmButton = screen.getByRole('button', { name: /confirmar cobro|cobrar|cobrando/i });
    expect(confirmButton).toBeDisabled();
  });

  it('displays collectionError message when provided', () => {
    renderDialogs({
      confirmingPayment: true,
      collectionAmount: '130.00',
      collectionError: 'Abra caja antes de registrar el cobro.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Abra caja antes de registrar el cobro.');
  });

  it('calls onCancelPayment when closing dialog', () => {
    const onCancelPayment = vi.fn();
    renderDialogs({
      confirmingPayment: true,
      onCancelPayment,
    });

    const cancelButton = screen.getByRole('button', { name: /dejar pendiente/i });
    fireEvent.click(cancelButton);
    expect(onCancelPayment).toHaveBeenCalledTimes(1);
  });
});

describe('InvoiceHistoryActionDialogs — Reprint Dialog', () => {
  it('enforces min 5 chars reason validation for receipt reprint', () => {
    renderDialogs({
      confirmingReprint: true,
      reprintPrintInfo: '1 ejemplar (ORIGINAL)',
    });

    expect(screen.getByRole('dialog', { name: /reimprimir 000-001-01-00000101/i })).toBeInTheDocument();
    expect(screen.getByText('1 ejemplar (ORIGINAL)')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /^reimprimir$/i });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button and calls onConfirmReprint when reason >= 5 chars', async () => {
    const user = userEvent.setup();
    const onConfirmReprint = vi.fn();
    renderDialogs({
      confirmingReprint: true,
      onConfirmReprint,
    });

    const textarea = screen.getByRole('textbox', { name: /motivo \*/i });
    await user.type(textarea, 'Reimpresión solicitada por paciente');

    const confirmButton = screen.getByRole('button', { name: /^reimprimir$/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirmReprint).toHaveBeenCalledWith('Reimpresión solicitada por paciente');
  });
});
