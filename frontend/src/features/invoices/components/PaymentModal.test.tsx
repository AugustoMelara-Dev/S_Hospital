import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentModal } from './PaymentModal';

describe('PaymentModal', () => {
  it('applies received cash as balance due and keeps change visible', async () => {
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000003"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="17.25"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={confirmSpy}
      />,
    );

    expect(screen.getAllByText('L 17.25').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('17.25');
    });
  });

  it('does not manually confirm from amount keydown before the form submit', async () => {
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000008"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="17.25"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={confirmSpy}
      />,
    );

    const amountInput = screen.getByLabelText(/monto recibido/i);
    fireEvent.keyDown(amountInput, { key: 'Enter', code: 'Enter' });
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.submit(amountInput.closest('form')!);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    expect(confirmSpy).toHaveBeenCalledWith('17.25');
  });

  it('allows cash above balance to calculate change but applies only the balance due', async () => {
    const onPaymentAmountChange = vi.fn();
    const confirmSpy = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000009"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="50.00"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={onPaymentAmountChange}
        onConfirm={confirmSpy}
      />,
    );

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

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000010"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="transfer"
        paymentAmount=""
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={onPaymentAmountChange}
        onConfirm={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(/monto recibido/i) as HTMLInputElement;

    fireEvent.change(amountInput, { target: { value: '50.00' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');
    expect(screen.getByText(/El pago no puede superar el saldo pendiente/i)).toBeInTheDocument();
  });

  it('normalizes comma decimal input for cashier locale', () => {
    const onPaymentAmountChange = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000011"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount=""
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={onPaymentAmountChange}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '17,25' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');
  });

  it('keeps visible progress and prevents closing while a payment is being registered', () => {
    const onOpenChange = vi.fn();

    render(
      <PaymentModal
        open
        submitting
        onOpenChange={onOpenChange}
        invoiceNumber="000-001-01-00000012"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
        paymentAmount="17.25"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/registrando cobro/i);
    expect(screen.getByRole('button', { name: /dejar pendiente/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /dejar pendiente/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('disables the Pay button when a non-cash amount exceeds the pending balance', () => {
    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000010"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="transfer"
        paymentAmount="99.99"
        onPaymentMethodChange={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const payButton = screen.getByRole('button', { name: /confirmar cobro/i });
    expect(payButton).toBeDisabled();
  });
});
