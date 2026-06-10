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

    expect(screen.getAllByText('L. 17.25').length).toBeGreaterThan(0);
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

  it('caps the amount input to the pending balance and shows an inline notice', () => {
    const onPaymentAmountChange = vi.fn();

    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000009"
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

    const amountInput = screen.getByLabelText(/monto recibido/i) as HTMLInputElement;
    expect(amountInput.max).toBe('17.25');

    fireEvent.change(amountInput, { target: { value: '50.00' } });

    expect(onPaymentAmountChange).toHaveBeenCalledWith('17.25');
    expect(screen.getByText(/El pago no puede superar el saldo pendiente/i)).toBeInTheDocument();
  });

  it('disables the Pay button when the entered amount exceeds the pending balance', () => {
    render(
      <PaymentModal
        open
        onOpenChange={vi.fn()}
        invoiceNumber="000-001-01-00000010"
        patientName="Maria Lopez"
        total="17.25"
        balanceDue="17.25"
        paymentMethod="cash"
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
