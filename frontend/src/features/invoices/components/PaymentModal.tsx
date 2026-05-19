import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import type { Payment } from '../../../lib/api';

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  patientName: string;
  total: string;
  balanceDue: string;
  paymentMethod: Payment['method'];
  paymentAmount: string;
  onPaymentMethodChange: (method: Payment['method']) => void;
  onPaymentAmountChange: (amount: string) => void;
  onConfirm: (appliedAmount: string) => void;
  submitting?: boolean;
};

export function PaymentModal({
  open,
  onOpenChange,
  invoiceNumber,
  patientName,
  total,
  balanceDue,
  paymentMethod,
  paymentAmount,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onConfirm,
  submitting,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const balance = parseFloat(balanceDue);
  const payment = parseFloat(paymentAmount);
  const change = !isNaN(payment) && payment > balance ? payment - balance : null;
  const remainingBalance = !isNaN(payment) && !isNaN(balance) && payment > 0 && payment < balance
    ? balance - payment
    : null;
  const appliedAmount = !isNaN(payment) && !isNaN(balance) && payment >= balance ? balance : payment;

  useEffect(() => {
    if (open) {
      setError(null);
      window.setTimeout(() => amountInputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingrese un monto valido');
      amountInputRef.current?.focus();
      return;
    }
    setError(null);
    onConfirm(appliedAmount.toFixed(2));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago"
      description={`Cobrar factura ${invoiceNumber}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paciente:</span>
            <span className="font-medium">{patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">L. {total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo pendiente:</span>
            <span className="font-bold">L. {balanceDue}</span>
          </div>
          {change !== null && (
            <div className="flex justify-between text-emerald-600">
              <span className="text-muted-foreground">Cambio:</span>
              <span className="font-bold">L. {change.toFixed(2)}</span>
            </div>
          )}
          {remainingBalance !== null && (
            <div className="flex justify-between text-amber-700">
              <span className="text-muted-foreground">Saldo pendiente:</span>
              <span className="font-bold">L. {remainingBalance.toFixed(2)}</span>
            </div>
          )}
          {!isNaN(appliedAmount) && appliedAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pago aplicado:</span>
              <span className="font-medium">L. {appliedAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="payment-method" className="mb-1.5 block">Metodo de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as Payment['method'])}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Seleccione metodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment-amount" className="mb-1.5 block">Monto recibido (L.)</Label>
            <Input
              ref={amountInputRef}
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => onPaymentAmountChange(e.target.value)}
              placeholder="0.00"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'payment-amount-error' : undefined}
            />
            {error && <p id="payment-amount-error" className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? 'Cobrando...' : 'Confirmar cobro'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
