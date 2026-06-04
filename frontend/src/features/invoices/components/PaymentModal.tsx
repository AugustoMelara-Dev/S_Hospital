import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import type { Payment } from '../../../lib/api';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';
import { t } from '../../../lib/i18n';
import { STRINGS } from '../../../lib/i18n';

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewBeforePrint?: boolean;
  invoiceNumber: string;
  patientName: string;
  total: string;
  balanceDue: string;
  paymentMethod: Payment['method'];
  paymentAmount: string;
  onPaymentMethodChange: (method: Payment['method']) => void;
  onPaymentAmountChange: (amount: string) => void;
  onPreviewBeforePrintChange?: (enabled: boolean) => void;
  onConfirm: (appliedAmount: string) => void;
  submitting?: boolean;
  partialPaymentsEnabled?: boolean;
};

export function PaymentModal({
  open,
  onOpenChange,
  previewBeforePrint = false,
  invoiceNumber,
  patientName,
  total,
  balanceDue,
  paymentMethod,
  paymentAmount,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPreviewBeforePrintChange,
  onConfirm,
  submitting,
  partialPaymentsEnabled = false,
}: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const balanceCents = parseCents(balanceDue) ?? 0;
  const paymentCents = parseCents(paymentAmount) ?? 0;
  const changeCents = paymentCents !== null && balanceCents !== null && paymentCents > balanceCents
    ? paymentCents - balanceCents
    : null;
  const remainingBalanceCents = paymentCents !== null && balanceCents !== null && paymentCents > 0 && paymentCents < balanceCents
    ? balanceCents - paymentCents
    : null;
  const appliedAmountCents = paymentCents !== null && balanceCents !== null && paymentCents >= balanceCents
    ? balanceCents
    : paymentCents;
  const needsAmount = paymentCents === null || paymentCents <= 0;

  useEffect(() => {
    if (open) {
      setError(null);
      window.setTimeout(() => amountInputRef.current?.focus(), 0);
    }
  }, [open]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountCents = parseCents(paymentAmount) ?? 0;
    if (amountCents === null || amountCents <= 0) {
      setError(t('invoicePayment.invalidAmount'));
      amountInputRef.current?.focus();
      return;
    }
    if (balanceCents !== null && amountCents < balanceCents && !partialPaymentsEnabled) {
      setError(t('invoicePayment.amountLessThanTotal'));
      amountInputRef.current?.focus();
      return;
    }
    setError(null);
    onConfirm(formatMoneyCents(appliedAmountCents ?? amountCents));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('invoicePayment.title')}
      description={STRINGS.invoicePayment.description(invoiceNumber)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoicePayment.patientLabel')}</span>
            <span className="font-medium">{patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoicePayment.totalLabel')}</span>
            <span className="font-medium">{moneyLabel(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoicePayment.balanceDueLabel')}</span>
            <span className="font-bold">{moneyLabel(balanceDue)}</span>
          </div>
          {changeCents !== null && (
            <div className="flex justify-between text-emerald-600">
              <span className="text-muted-foreground">{t('invoicePayment.changeLabel')}</span>
              <span className="font-bold">{moneyLabelFromCents(changeCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && (
            <div className="flex justify-between text-amber-700">
              <span className="text-muted-foreground">{t('invoicePayment.balanceDueLabel')}</span>
              <span className="font-bold">{moneyLabelFromCents(remainingBalanceCents)}</span>
            </div>
          )}
          {remainingBalanceCents !== null && !partialPaymentsEnabled ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">
              {t('invoicePayment.amountLessThanTotal')}
            </div>
          ) : null}
          {remainingBalanceCents !== null && partialPaymentsEnabled ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
              {t('invoicePayment.partialNotice')}
            </div>
          ) : null}
          {appliedAmountCents !== null && appliedAmountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('invoicePayment.appliedLabel')}</span>
              <span className="font-medium">{moneyLabelFromCents(appliedAmountCents)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {needsAmount && !error ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
              {t('invoicePayment.needsAmountWarning')}
            </div>
          ) : null}

          <div>
            <Label htmlFor="payment-method" className="mb-1.5 block">{t('invoicePayment.methodLabel')}</Label>
            <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as Payment['method'])}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder={t('invoicePayment.methodPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('invoicePayment.methodCash')}</SelectItem>
                <SelectItem value="card">{t('invoicePayment.methodCard')}</SelectItem>
                <SelectItem value="transfer">{t('invoicePayment.methodTransfer')}</SelectItem>
                <SelectItem value="other">{t('invoicePayment.methodOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment-amount" className="mb-1.5 block">{t('invoicePayment.amountLabel')}</Label>
            <Input
              ref={amountInputRef}
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => {
                setError(null);
                onPaymentAmountChange(e.target.value);
              }}
              placeholder={t('invoicePayment.amountPlaceholder')}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'payment-amount-error' : undefined}
            />
            {error && <p id="payment-amount-error" className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm select-none">
            <Checkbox
              id="preview-before-print"
              checked={previewBeforePrint}
              onCheckedChange={(checked) => onPreviewBeforePrintChange?.(checked === true)}
              className="mt-0.5"
            />
            <div className="grid gap-0.5 leading-none">
              <Label htmlFor="preview-before-print" className="cursor-pointer font-medium text-foreground">
                {t('invoicePayment.previewLabel')}
              </Label>
              <span className="text-xs text-muted-foreground mt-0.5">
                {t('invoicePayment.previewHelp')}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('invoicePayment.printDisclaimer')}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('invoicePayment.leavePending')}
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting}
            aria-label={previewBeforePrint ? t('invoicePayment.ariaConfirmPreview') : t('invoicePayment.ariaConfirmPrint')}
          >
            {submitting
              ? t('invoicePayment.submitting')
              : previewBeforePrint
                ? t('invoicePayment.submitPreview')
                : t('invoicePayment.submitPrint')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function formatMoneyCents(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}

function moneyLabelFromCents(cents: number): string {
  return formatLempirasFromCents(cents);
}
