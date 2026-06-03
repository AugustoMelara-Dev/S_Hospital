import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';
import { STRINGS, t } from '../../../lib/i18n';

type CartItem = {
  service: import('../../../lib/api').Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type InvoiceConfirmationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  items: CartItem[];
  preview: { subtotal: string; tax: string; total: string };
  taxRate?: string;
  cashSessionId?: number;
  onConfirm: () => void;
  submitting?: boolean;
};

export function InvoiceConfirmation({
  open,
  onOpenChange,
  patientName,
  items,
  preview,
  taxRate,
  cashSessionId,
  onConfirm,
  submitting,
}: InvoiceConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const willOpenPayment = Boolean(cashSessionId) && (parseCents(preview.total) ?? 0) > 0;

  useEffect(() => {
    if (open) {
      window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={willOpenPayment ? t('invoiceConfirmation.titleWithPayment') : t('invoiceConfirmation.titleOnly')}
      description={
        willOpenPayment
          ? t('invoiceConfirmation.descriptionWithPayment')
          : t('invoiceConfirmation.descriptionOnly')
      }
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoiceConfirmation.patientLabel')}</span>
            <span className="font-medium">{patientName || t('invoiceConfirmation.noName')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoiceConfirmation.cashboxLabel')}</span>
            <span className="font-medium">#{cashSessionId ?? t('invoiceConfirmation.noCashbox')}</span>
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="font-semibold text-sm mb-2">{t('invoiceConfirmation.servicesLabel')}</p>
          <ul className="space-y-1.5 text-sm max-h-[200px] overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item.service.id}-${index}`} className="flex justify-between">
                <span>
                  {item.quantity} x {item.service.name}
                </span>
                {item.dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? (
                  <span className="text-emerald-600 font-medium">{t('invoiceConfirmation.free')}</span>
                ) : (
                  <span className="text-muted-foreground">{moneyLabel(item.service.price)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5 text-sm border-t border-border pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoiceConfirmation.subtotalLabel')}</span>
            <span>{moneyLabel(preview.subtotal)}</span>
          </div>
          {taxRate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{STRINGS.invoiceConfirmation.taxLabel(taxRate)}</span>
              <span>{moneyLabel(preview.tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>{t('invoiceConfirmation.estimatedTotalLabel')}</span>
            <span>{moneyLabel(preview.total)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('invoiceConfirmation.finalPricesDisclaimer')}
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('invoiceConfirmation.cancel')}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            className="flex-1"
            onClick={onConfirm}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) {
                e.preventDefault();
                return;
              }

              if (e.key === 'Enter' && !submitting) {
                e.preventDefault();
                onConfirm();
              }
            }}
            disabled={submitting}
          >
            {submitting
              ? t('invoiceConfirmation.submitting')
              : willOpenPayment
                ? t('invoiceConfirmation.submitWithPayment')
                : t('invoiceConfirmation.submitOnly')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}
