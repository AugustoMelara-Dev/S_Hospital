import { type FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog } from '../../../components/ui/dialog';
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
  onConfirm: () => void;
  submitting?: boolean;
};

const PAYMENT_METHODS: { value: Payment['method']; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

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

  const balance = parseFloat(balanceDue);
  const payment = parseFloat(paymentAmount);
  const change = !isNaN(payment) && payment > balance ? payment - balance : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingrese un monto valido');
      return;
    }
    if (amount < balance) {
      setError(`El monto debe ser al menos L. ${balance.toFixed(2)}`);
      return;
    }
    setError(null);
    onConfirm();
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
            <div className="flex justify-between text-green-600">
              <span className="text-muted-foreground">Cambio:</span>
              <span className="font-bold">L. {change.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="payment-method" className="mb-1.5 block">Metodo de pago</Label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value as Payment['method'])}
              className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="payment-amount" className="mb-1.5 block">Monto recibido (L.)</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => onPaymentAmountChange(e.target.value)}
              placeholder="0.00"
            />
            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
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