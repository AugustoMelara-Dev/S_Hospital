import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentModal } from './PaymentModal';
import type { Payment } from '../../../lib/api';

type PaymentModalTestProps = ComponentProps<typeof PaymentModal>;

const defaultProps: PaymentModalTestProps = {
  open: true,
  onOpenChange: vi.fn(),
  invoiceNumber: '000-001-01-00000003',
  patientName: 'Maria Lopez',
  total: '17.25',
  balanceDue: '17.25',
  paymentMethod: 'cash',
  paymentAmount: '17.25',
  onPaymentMethodChange: vi.fn(),
  onPaymentAmountChange: vi.fn(),
  onConfirm: vi.fn(),
};

function renderPaymentModal(overrides: Partial<PaymentModalTestProps> = {}) {
  const props = {
    ...defaultProps,
    onOpenChange: vi.fn(),
    onPaymentMethodChange: vi.fn(),
    onPaymentAmountChange: vi.fn(),
    onPaymentReferenceChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  } satisfies PaymentModalTestProps;

  return {
    ...render(<PaymentModal {...props} />),
    props,
  };
}

afterEach(() => {
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
});

describe('PaymentModal', () => {
  it('exposes an accessible dialog title and description tied to the invoice', () => {
    renderPaymentModal({ invoiceNumber: '000-001-01-00000044' });

    expect(screen.getByRole('dialog', { name: /registrar pago/i })).toBeInTheDocument();
    expect(screen.getByText(/factura 000-001-01-00000044.*pendiente de cobro/i)).toBeInTheDocument();
    expect(screen.getByText('000-001-01-00000044')).toBeInTheDocument();
  });

  it('renders patient identity, fallback and current balance formatting', () => {
    const { rerender, props } = renderPaymentModal({
      patientName: 'Maria Lopez',
      balanceDue: '0.00',
      paymentAmount: '0.00',
    });

    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getAllByText('L 0.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /confirmar cobro/i })).toBeDisabled();

    rerender(<PaymentModal {...props} patientName="" invoiceNumber="000-001-01-00000045" />);
    expect(screen.getByText('Paciente no especificado')).toBeInTheDocument();
  });

  it('uses semantic theme colors for the invoice summary in light and dark themes', () => {
    renderPaymentModal({
      paymentAmount: '10.00',
      partialPaymentsEnabled: true,
    });

    const summary = screen.getByRole('region', { name: 'Resumen de factura' });
    expect(summary).toHaveClass('bg-surface');
    expect(summary.innerHTML).not.toMatch(/(?:text|bg|border)-(?:white|black|neutral|amber)(?:-|\b)/);
    expect(screen.getByText('Saldo después del pago')).toBeInTheDocument();
    expect(screen.getByText('L 7.25')).toHaveClass('text-warning-foreground');
  });

  it('selects the prefilled amount when opened for quick overwrite', async () => {
    renderPaymentModal({ paymentAmount: '17.25' });

    const amountInput = screen.getByLabelText(/monto recibido/i) as HTMLInputElement;

    await waitFor(() => {
      expect(amountInput).toHaveFocus();
      expect(amountInput.selectionStart).toBe(0);
      expect(amountInput.selectionEnd).toBe(amountInput.value.length);
    });
  });

  it('applies received cash as balance due and keeps change visible', async () => {
    const confirmSpy = vi.fn();

    renderPaymentModal({ onConfirm: confirmSpy });

    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
  });

  it('does not manually confirm from amount keydown before the form submit', async () => {
    const confirmSpy = vi.fn();

    renderPaymentModal({ onConfirm: confirmSpy });

    const amountInput = screen.getByLabelText(/monto recibido/i);
    fireEvent.keyDown(amountInput, { key: 'Enter', code: 'Enter' });
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.submit(amountInput.closest('form')!);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    expect(confirmSpy).toHaveBeenCalledWith('17.25');
  });

  it('submits the payment with Ctrl+Enter from the amount field', async () => {
    const confirmSpy = vi.fn();

    renderPaymentModal({ onConfirm: confirmSpy });

    fireEvent.keyDown(screen.getByLabelText(/monto recibido/i), {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    expect(confirmSpy).toHaveBeenCalledWith('17.25');
  });

  it('allows cash above balance to calculate change but applies only the balance due', async () => {
    const onPaymentAmountChange = vi.fn();
    const confirmSpy = vi.fn();

    renderPaymentModal({
      invoiceNumber: '000-001-01-00000009',
      paymentAmount: '50.00',
      onPaymentAmountChange,
      onConfirm: confirmSpy,
    });

    expect(screen.getByText('Cambio:')).toBeInTheDocument();
    expect(screen.getByText('L 32.75')).toBeInTheDocument();
    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
    expect(onPaymentAmountChange).not.toHaveBeenCalled();
  });

  it('hides received amount and change for non-cash methods while requesting the real reference', () => {
    renderPaymentModal({
      invoiceNumber: '000-001-01-00000010',
      paymentMethod: 'transfer',
      paymentAmount: '99.99',
      paymentReference: 'TX-101',
    });

    expect(screen.queryByLabelText(/monto recibido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cambio/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/referencia de pago/i)).toHaveValue('TX-101');
    expect(screen.getByRole('button', { name: /confirmar cobro/i })).toBeEnabled();
  });

  it('normalizes comma decimal input for cashier locale without changing payload units', async () => {
    const onPaymentAmountChange = vi.fn();
    const confirmSpy = vi.fn();

    const { rerender, props } = renderPaymentModal({
      invoiceNumber: '000-001-01-00000011',
      paymentAmount: '',
      onPaymentAmountChange,
      onConfirm: confirmSpy,
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '17,25' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');

    rerender(<PaymentModal {...props} paymentAmount="17.25" />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
  });

  it('accepts pasted amount values with surrounding spaces', () => {
    const onPaymentAmountChange = vi.fn();

    renderPaymentModal({
      paymentAmount: '',
      onPaymentAmountChange,
    });

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: ' 17.25 ' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');
  });

  it('keeps visible progress and prevents closing while a payment is being registered', () => {
    const onOpenChange = vi.fn();

    renderPaymentModal({
      submitting: true,
      onOpenChange,
      invoiceNumber: '000-001-01-00000012',
    });

    expect(screen.getAllByRole('status').some((status) => /registrando cobro/i.test(status.textContent ?? ''))).toBe(true);
    expect(screen.getByRole('button', { name: /dejar pendiente/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /dejar pendiente/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ignores direct form submits while a payment is already being registered', () => {
    const confirmSpy = vi.fn();

    renderPaymentModal({
      submitting: true,
      onConfirm: confirmSpy,
    });

    fireEvent.submit(screen.getByLabelText(/monto recibido/i).closest('form')!);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('locks payment fields while a payment is already being registered', () => {
    renderPaymentModal({
      submitting: true,
      paymentMethod: 'transfer',
      paymentReference: 'TX-101',
    });

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    screen.getAllByRole('radio').forEach((method) => expect(method).toBeDisabled());
    expect(screen.queryByLabelText(/monto recibido/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/referencia de pago/i)).toBeDisabled();
    expect(screen.getByText(/cobrando/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar cobro/i })).toBeDisabled();
  });

  it('ignores residual received cash when confirming a non-cash payment', async () => {
    const confirmSpy = vi.fn();
    renderPaymentModal({
      invoiceNumber: '000-001-01-00000010',
      paymentMethod: 'transfer',
      paymentAmount: '99.99',
      paymentReference: 'TX-101',
      onConfirm: confirmSpy,
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('17.25'));
  });

  it('keeps real payment methods and their display labels only', () => {
    const methods: Array<[Payment['method'], string]> = [
      ['cash', 'Efectivo'],
      ['card', 'Tarjeta'],
      ['transfer', 'Transferencia'],
      ['other', 'Otro'],
    ];

    for (const [method, label] of methods) {
      const { unmount } = renderPaymentModal({ paymentMethod: method });
      expect(screen.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
      unmount();
    }

    renderPaymentModal({ paymentMethod: 'card' });
    expect(screen.queryByLabelText(/banco/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/numero de tarjeta/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
  });

  it('shows reference only for non-cash methods and preserves the reference callback value', () => {
    const onPaymentReferenceChange = vi.fn();
    const { rerender, props } = renderPaymentModal({
      paymentMethod: 'cash',
      onPaymentReferenceChange,
    });

    expect(screen.queryByLabelText(/referencia de pago/i)).not.toBeInTheDocument();

    rerender(
      <PaymentModal
        {...props}
        paymentMethod="transfer"
        paymentReference="TX-101"
        onPaymentReferenceChange={onPaymentReferenceChange}
      />,
    );

    const referenceInput = screen.getByLabelText(/referencia de pago/i);
    expect(referenceInput).toHaveValue('TX-101');

    fireEvent.change(referenceInput, { target: { value: 'DEP-2026-06' } });
    expect(onPaymentReferenceChange).toHaveBeenCalledWith('DEP-2026-06');
  });

  it('offers cash presets for exact, 100, 200 and 500 only when paying cash', () => {
    const onPaymentAmountChange = vi.fn();
    const { rerender, props } = renderPaymentModal({
      paymentMethod: 'cash',
      balanceDue: '17.25',
      onPaymentAmountChange,
    });

    for (const label of ['Exacto', 'L 100', 'L 200', 'L 500']) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Exacto' }));
    fireEvent.click(screen.getByRole('button', { name: 'L 200' }));
    expect(onPaymentAmountChange).toHaveBeenNthCalledWith(1, '17.25');
    expect(onPaymentAmountChange).toHaveBeenNthCalledWith(2, '200.00');

    rerender(<PaymentModal {...props} paymentMethod="card" onPaymentAmountChange={onPaymentAmountChange} />);
    expect(screen.queryByRole('button', { name: 'Exacto' })).not.toBeInTheDocument();
  });

  it('presents total, received and change as the primary collection summary', () => {
    renderPaymentModal({ balanceDue: '17.25', paymentAmount: '20.00' });

    const summary = screen.getByRole('region', { name: /resumen del cobro/i });
    expect(summary).toHaveTextContent(/Total/);
    expect(summary).toHaveTextContent(/Recibido/);
    expect(summary).toHaveTextContent(/Cambio/);
    expect(summary).toHaveTextContent('L 17.25');
    expect(summary).toHaveTextContent('L 20.00');
    expect(summary).toHaveTextContent('L 2.75');
  });

  it.each(['card', 'transfer', 'other'] as const)('hides change and uses two summary columns for %s', (paymentMethod) => {
    renderPaymentModal({ paymentMethod, balanceDue: '17.25', paymentAmount: '17.25' });

    const summary = screen.getByRole('region', { name: /resumen del cobro/i });
    expect(summary).not.toHaveTextContent(/Cambio/);
    expect(summary).not.toHaveTextContent(/Recibido/);
    expect(summary).toHaveAttribute('data-summary-columns', '2');
  });

  it('does not request a reference for the other payment method', () => {
    renderPaymentModal({ paymentMethod: 'other', paymentReference: '' });

    expect(screen.queryByLabelText(/referencia de pago/i)).not.toBeInTheDocument();
  });

  it('exposes payment methods as accessible tiles and includes the total in the primary action', () => {
    renderPaymentModal({ paymentMethod: 'cash', balanceDue: '17.25' });

    expect(screen.getByRole('radiogroup', { name: /método de pago/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /confirmar cobro de l 17\.25/i })).toBeEnabled();
  });

  it('uses roving tab focus and arrow, Home and End navigation for payment methods', async () => {
    const onPaymentMethodChange = vi.fn();
    const { rerender, props } = renderPaymentModal({ paymentMethod: 'cash', onPaymentMethodChange });

    const cash = screen.getByRole('radio', { name: 'Efectivo' });
    const card = screen.getByRole('radio', { name: 'Tarjeta' });
    const other = screen.getByRole('radio', { name: 'Otro' });
    expect(cash).toHaveAttribute('tabindex', '0');
    expect(card).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(cash, { key: 'ArrowRight' });
    expect(onPaymentMethodChange).toHaveBeenLastCalledWith('card');
    await waitFor(() => expect(card).toHaveFocus());

    rerender(<PaymentModal {...props} paymentMethod="card" onPaymentMethodChange={onPaymentMethodChange} />);
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key: 'End' });
    expect(onPaymentMethodChange).toHaveBeenLastCalledWith('other');
    await waitFor(() => expect(other).toHaveFocus());

    fireEvent.keyDown(other, { key: 'Home' });
    expect(onPaymentMethodChange).toHaveBeenLastCalledWith('cash');
    await waitFor(() => expect(cash).toHaveFocus());
  });

  it('does not navigate or change payment methods while submitting', () => {
    const onPaymentMethodChange = vi.fn();
    renderPaymentModal({ submitting: true, paymentMethod: 'cash', onPaymentMethodChange });

    const cash = screen.getByRole('radio', { name: 'Efectivo' });
    fireEvent.keyDown(cash, { key: 'ArrowDown' });

    expect(onPaymentMethodChange).not.toHaveBeenCalled();
    expect(cash).toHaveAttribute('tabindex', '0');
  });

  it('clears a residual reference when changing to a method that does not require it', () => {
    const onPaymentMethodChange = vi.fn();
    const onPaymentReferenceChange = vi.fn();
    renderPaymentModal({
      paymentMethod: 'transfer',
      paymentReference: 'TX-RESIDUAL',
      onPaymentMethodChange,
      onPaymentReferenceChange,
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));

    expect(onPaymentMethodChange).toHaveBeenCalledWith('other');
    expect(onPaymentReferenceChange).toHaveBeenCalledWith('');
  });

  it('submits only once when the cashier double clicks confirm', async () => {
    const confirmSpy = vi.fn();
    renderPaymentModal({ onConfirm: confirmSpy });

    const confirmButton = screen.getByRole('button', { name: /confirmar cobro/i });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  });

  it('requires a reference before confirming card or transfer payments', () => {
    const confirmSpy = vi.fn();

    renderPaymentModal({
      paymentMethod: 'transfer',
      paymentAmount: '17.25',
      paymentReference: '   ',
      onConfirm: confirmSpy,
    });

    const referenceInput = screen.getByLabelText(/referencia de pago/i);
    fireEvent.submit(referenceInput.closest('form')!);

    expect(referenceInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/ingrese la referencia/i);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('keeps partial payment blocked by default and allowed when the consumer enables it', async () => {
    const confirmSpy = vi.fn();
    const { rerender, props } = renderPaymentModal({
      paymentAmount: '5.00',
      partialPaymentsEnabled: false,
      onConfirm: confirmSpy,
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/menor al total/i);
    fireEvent.submit(screen.getByLabelText(/monto recibido/i).closest('form')!);
    expect(screen.getAllByText('El monto recibido es menor al total.').length).toBeGreaterThan(0);
    expect(confirmSpy).not.toHaveBeenCalled();

    rerender(<PaymentModal {...props} paymentAmount="5.00" partialPaymentsEnabled />);
    const partialPaymentButton = screen.getByRole('button', { name: /registrar abono de l 5\.00/i });
    expect(partialPaymentButton).toHaveTextContent(/registrar abono l 5\.00/i);
    const paymentSummary = screen.getByRole('region', { name: /resumen del cobro/i });
    expect(within(paymentSummary).getByText(/abono aplicado/i)).toBeInTheDocument();
    expect(within(paymentSummary).getByText('L 5.00')).toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText(/monto recibido/i).closest('form')!);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('5.00');
    });
  });

  it('associates validation errors with the amount input and keeps the dialog open', () => {
    const onOpenChange = vi.fn();
    const confirmSpy = vi.fn();

    renderPaymentModal({ paymentAmount: '0.00', onOpenChange, onConfirm: confirmSpy });

    const amountInput = screen.getByLabelText(/monto recibido/i);
    fireEvent.submit(amountInput.closest('form')!);

    expect(amountInput).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput).toHaveAccessibleDescription(/use hasta dos decimales/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/monto v[aá]lido/i);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps amount guidance human and free of implementation wording', () => {
    renderPaymentModal();

    expect(screen.getByText(/use hasta dos decimales/i)).toHaveTextContent(/se registrara el monto aplicado a la factura/i);
    expect(document.body.textContent).not.toMatch(/\bbackend\b/i);
  });

  it('does not submit automatically or call receipt/pdf browser handoffs from the modal', () => {
    const confirmSpy = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderPaymentModal({ onConfirm: confirmSpy });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('keeps payment focused on a single print action without preview-before-print controls', () => {
    const onConfirm = vi.fn();

    renderPaymentModal({
      onConfirm,
    });

    expect(screen.queryByRole('checkbox', { name: /preview|vista previa/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/preview antes de imprimir/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar cobro/i })).toBeInTheDocument();
  });

  it('keeps cancel separate from submit', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    renderPaymentModal({
      onOpenChange,
      onConfirm,
    });

    fireEvent.click(screen.getByRole('button', { name: /dejar pendiente/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resets inline errors when reopened or when another invoice is shown', () => {
    const { rerender, props } = renderPaymentModal({
      paymentAmount: '0.00',
      invoiceNumber: '000-001-01-00000020',
    });

    fireEvent.submit(screen.getByLabelText(/monto recibido/i).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent(/monto v[aá]lido/i);

    rerender(<PaymentModal {...props} open={false} />);
    rerender(<PaymentModal {...props} open invoiceNumber="000-001-01-00000021" />);
    expect(screen.queryByText(/Ingrese un monto v[aá]lido/i)).not.toBeInTheDocument();

    fireEvent.submit(screen.getByLabelText(/monto recibido/i).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent(/monto v[aá]lido/i);

    rerender(<PaymentModal {...props} open invoiceNumber="000-001-01-00000022" />);
    expect(screen.queryByText(/Ingrese un monto v[aá]lido/i)).not.toBeInTheDocument();
  });

  it('accepts dark mode without changing the payment submit contract', async () => {
    const confirmSpy = vi.fn();
    document.documentElement.classList.add('dark');

    renderPaymentModal({ onConfirm: confirmSpy });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
  });

  it('shows a server payment error inside the open dialog and labels the retry action', () => {
    renderPaymentModal({ errorMessage: 'El servidor local no pudo completar el cobro.' });

    const dialog = screen.getByRole('dialog', { name: /registrar pago/i });
    expect(dialog).toHaveTextContent('El servidor local no pudo completar el cobro.');
    expect(screen.getByRole('button', { name: /reintentar cobro/i })).toBeEnabled();
  });
});
