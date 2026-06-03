import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { SuccessCheckmark } from '../../../components/ui/animations';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';
import { STRINGS, t } from '../../../lib/i18n';

type InvoiceStatus = 'issued' | 'paid' | 'partial' | 'void';

type InvoiceSuccessProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  patientName: string;
  total: string;
  status: InvoiceStatus;
  onCobrar: () => void;
  onImprimir: () => void;
  onNuevaFactura: () => void;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: t('invoiceSuccess.statusIssued'),
  paid: t('invoiceSuccess.statusPaid'),
  partial: t('invoiceSuccess.statusPartial'),
  void: t('invoiceSuccess.statusVoid'),
};

export function InvoiceSuccess({
  open,
  onOpenChange,
  invoiceNumber,
  patientName,
  total,
  status,
  onCobrar,
  onImprimir,
  onNuevaFactura,
}: InvoiceSuccessProps) {
  const needsPayment = status === 'issued' || status === 'partial';
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => primaryActionRef.current?.focus(), 0);
    }
  }, [open, needsPayment]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('invoiceSuccess.title')}
      description={needsPayment
        ? STRINGS.invoiceSuccess.descriptionPending(invoiceNumber)
        : STRINGS.invoiceSuccess.descriptionPaid(invoiceNumber)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-center py-2 animate-[scale-in_0.3s_ease-out_both]">
          <SuccessCheckmark size="lg" />
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4">
          <p className="font-semibold text-emerald-900 dark:text-emerald-350 text-lg">{invoiceNumber}</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{t('invoiceSuccess.patientLabel')} <strong>{patientName}</strong></p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t('invoiceSuccess.totalLabel')} <strong>{moneyLabel(total)}</strong></p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-2 uppercase font-medium tracking-wide">
            {t('invoiceSuccess.statusLabel')} {STATUS_LABELS[status]}
          </p>
        </div>

        {needsPayment ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              {t('invoiceSuccess.pendingHint')}
            </p>
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onCobrar}>
              {t('invoiceSuccess.collectNow')}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              {t('invoiceSuccess.pendingAndNew')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button ref={primaryActionRef} type="button" size="lg" className="w-full font-semibold" onClick={onImprimir}>
              {t('invoiceSuccess.printReceipt')}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onNuevaFactura}>
              {t('invoiceSuccess.newInvoice')}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={onImprimir} disabled={needsPayment}>
              <Printer className="h-4 w-4 mr-2" />
              {t('invoiceSuccess.viewReceipt')}
            </Button>
            {needsPayment && (
              <p className="text-xs text-muted-foreground">
                {t('invoiceSuccess.availableAfterPaid')}
              </p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to={`/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`}>{t('invoiceSuccess.viewInvoice')}</Link>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}
