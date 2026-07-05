import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    const dialog = screen.getByRole('dialog', { name: /registrar pago/i });
    expect(dialog).toHaveAccessibleDescription(/factura 000-001-01-00000044/i);
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
    expect(screen.getByText('Pago aplicado:')).toBeInTheDocument();
    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
    expect(onPaymentAmountChange).not.toHaveBeenCalled();
  });

  it('caps non-cash amount input to the pending balance and shows an inline notice', () => {
    const onPaymentAmountChange = vi.fn();

    renderPaymentModal({
      invoiceNumber: '000-001-01-00000010',
      paymentMethod: 'transfer',
      paymentAmount: '',
      onPaymentAmountChange,
    });

    const amountInput = screen.getByLabelText(/monto recibido/i) as HTMLInputElement;

    fireEvent.change(amountInput, { target: { value: '50.00' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');
    expect(screen.getByText(/El pago no puede superar el saldo pendiente/i)).toBeInTheDocument();
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

    expect(screen.getByRole('status')).toHaveTextContent(/registrando cobro/i);
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

    expect(screen.getByRole('combobox', { name: /m.todo de pago/i })).toBeDisabled();
    expect(screen.getByLabelText(/monto recibido/i)).toBeDisabled();
    expect(screen.getByLabelText(/referencia de pago/i)).toBeDisabled();
    expect(screen.getByText(/cobrando/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar cobro e imprimir/i })).toBeDisabled();
  });

  it('disables the Pay button when a non-cash amount exceeds the pending balance', () => {
    renderPaymentModal({
      invoiceNumber: '000-001-01-00000010',
      paymentMethod: 'transfer',
      paymentAmount: '99.99',
    });

    const payButton = screen.getByRole('button', { name: /confirmar cobro/i });
    expect(payButton).toBeDisabled();
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
      expect(screen.getByRole('combobox', { name: /m[eé]todo de pago/i })).toHaveTextContent(label);
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
    expect(screen.getByRole('button', { name: /confirmar cobro e imprimir/i })).toBeInTheDocument();
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
});
