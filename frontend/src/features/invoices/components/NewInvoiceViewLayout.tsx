import { Link } from 'react-router-dom';
import type { RefObject } from 'react';
import { Banknote, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SectionCard } from '@/components/shared';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { PatientStep } from './PatientStep';
import { ServiceSearch } from './ServiceSearch';
import { InvoiceCart } from './InvoiceCart';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import { PaymentModal } from './PaymentModal';
import { InvoiceSuccess } from './InvoiceSuccess';
import type { Payment, ReceiptData, Service } from '../../../lib/api';
import type { NewInvoiceState } from '../state/types';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

export type NewInvoiceLayoutProps = {
  state: NewInvoiceState;
  preview: { subtotal: string; tax: string; total: string };
  emitBlockReasons: string[];
  canEmit: boolean;
  canCreatePayments: boolean;
  canOpenCash: boolean;
  canViewReceipts: boolean;
  canMarkDialysisPrescription?: boolean;
  onOpenCash?: () => void;
  onPatientNameChange: (value: string) => void;
  onPatientSubmit: () => void;
  onAreaChange: (val: number | 'all' | undefined) => void;
  onCategoryChange: (val: number | 'all' | undefined) => void;
  onSearchChange: (val: string) => void;
  onScanCodeChange: (val: string) => void;
  onAddService: (service: Service) => void;
  onAddByScanCode: () => void | Promise<void>;
  onUpdateQuantity: (index: number, quantity: string) => void;
  onUpdateDialysisPrescription: (index: number, checked: boolean) => void;
  onRemoveItem: (index: number) => void;
  onConfirm: () => void;
  onConfirmDialogChange: (val: boolean) => void;
  onPaymentMethodChange: (val: Payment['method']) => void;
  onPaymentAmountChange: (val: string) => void;
  onPaymentReferenceChange: (val: string) => void;
  onPreviewBeforePrintChange: (val: boolean) => void;
  onSubmitInvoice: () => void;
  onCobrar: () => void;
  onRetryLoad: () => void;
  onPaymentOpenChange: (val: boolean) => void;
  onSubmitPayment: (appliedAmount: string) => void;
  onLoadReceipt: (width: ReceiptData['width']) => void;
  onPrintIssuedReceipt: () => void;
  onNuevaFactura: () => void;
  onSuccessDialogChange: (val: boolean) => void;
  onReceiptOpenChange: (val: boolean) => void;
  onClearCart: () => void;
  onClearConfirmChange: (val: boolean) => void;
  onAutoPrintChange: (val: boolean) => void;
  patientInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scannerInputRef: RefObject<HTMLInputElement | null>;
};

export function NewInvoiceViewLayout(props: NewInvoiceLayoutProps) {
  const {
    state,
    preview,
    emitBlockReasons,
    canEmit,
    canCreatePayments,
    canOpenCash,
    canViewReceipts,
    onOpenCash,
    onPatientNameChange,
    onPatientSubmit,
    onAreaChange,
    onCategoryChange,
    onSearchChange,
    onScanCodeChange,
    onAddService,
    onAddByScanCode,
    onUpdateQuantity,
    onUpdateDialysisPrescription,
    onRemoveItem,
    onConfirm,
    onConfirmDialogChange,
    onPaymentMethodChange,
    onPaymentAmountChange,
    onPaymentReferenceChange,
    onPreviewBeforePrintChange,
    onSubmitInvoice,
    onCobrar,
    onRetryLoad,
    onPaymentOpenChange,
    onSubmitPayment,
    onLoadReceipt,
    onPrintIssuedReceipt,
    onNuevaFactura,
    onSuccessDialogChange,
    onReceiptOpenChange,
    onClearCart,
    onClearConfirmChange,
    onAutoPrintChange,
    patientInputRef,
    searchInputRef,
    scannerInputRef,
  } = props;

  const hasCartItems = state.cartItems.length > 0;
  const mobileActionLabel = state.submitting
    ? 'Emitiendo...'
    : canCreatePayments && canViewReceipts
      ? 'Emitir y cobrar'
      : 'Emitir factura';
  const cashIsOpen = Boolean(state.loadedCashSession);
  const cashSessionLabel = state.loadedCashSession ? `Caja #${state.loadedCashSession.id}` : 'Caja cerrada';
  const bannerLabel = cashIsOpen ? 'Lista para facturar' : 'Abra caja para empezar';

  const bannerAlertMessage = state.pointOfSaleLoadError;
  const inlineAlertMessage =
    !bannerAlertMessage && state.alertMessage ? state.alertMessage : null;
  const showInlineAlert = Boolean(
    inlineAlertMessage && inlineAlertMessage !== state.pointOfSaleLoadError,
  );

  return (
    <section id="nueva-factura" className="flex h-full flex-col gap-4 pb-24 lg:pb-0">
      <SectionCard
        aria-live="polite"
        title="Nueva factura"
        description="Registre paciente, agregue servicios facturables y continue al cobro institucional sin salir del flujo de caja."
        actions={
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
              cashIsOpen
                ? 'border-success/30 bg-success/10 text-success-foreground'
                : 'border-warning/40 bg-warning/10 text-warning-foreground'
            }`}
          >
            <span className="text-xs uppercase tracking-[0.14em]">Caja</span>
            <span className="font-mono font-semibold tabular-nums">{cashSessionLabel}</span>
            <span aria-hidden="true">{cashIsOpen ? '·' : '·'}</span>
            <span>{bannerLabel}</span>
            {!cashIsOpen && canOpenCash && onOpenCash ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                Abrir caja
              </Button>
            ) : null}
          </div>
        }
      >
        <output
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {bannerAlertMessage ?? state.warningMessage ?? ''}
        </output>
      </SectionCard>

      {bannerAlertMessage ? (
        <Alert
          variant="destructive"
          title="No se pudo cargar el punto de venta"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex-1">{bannerAlertMessage}</span>
            <Button type="button" variant="secondary" size="sm" onClick={onRetryLoad} disabled={state.loadingServices}>
              {state.loadingServices ? 'Reintentando...' : 'Reintentar'}
            </Button>
          </div>
        </Alert>
      ) : null}

      {!cashIsOpen && !bannerAlertMessage ? (
        <Alert variant="warning" title="Caja no abierta">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p>Debe abrir la caja antes de emitir facturas.</p>
              {!canOpenCash ? (
                <p className="mt-1 text-xs">Solicite apertura a un usuario autorizado.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {canOpenCash && onOpenCash ? (
                <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                  Abrir caja
                </Button>
              ) : null}
              {!canOpenCash ? (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/cashbox">Ir a caja</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </Alert>
      ) : null}

      {showInlineAlert && inlineAlertMessage ? (
        <Alert variant="destructive" title="Revise antes de continuar" role="alert">
          {inlineAlertMessage}
        </Alert>
      ) : null}

      {state.warningMessage && !showInlineAlert ? (
        <Alert variant="warning" title="Factura pendiente" role="status">
          {state.warningMessage}
        </Alert>
      ) : null}

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          <SectionCard
            title="1. Paciente"
            description="Registre el nombre del paciente y continue al siguiente paso."
          >
            <PatientStep
              ref={patientInputRef}
              patientName={state.patientName}
              onPatientNameChange={onPatientNameChange}
              onPatientSubmit={onPatientSubmit}
              error={state.patientError}
            />
          </SectionCard>

          <SectionCard
            title="2. Servicios"
            description="Busque por nombre, area o codigo de barra. Cada Enter agrega el resultado."
            className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
          >
            <ServiceSearch
              categories={state.categories}
              serviceAreas={state.serviceAreas}
              services={state.services}
              selectedAreaId={state.selectedAreaId}
              selectedCategoryId={state.selectedCategoryId}
              onAreaChange={onAreaChange}
              onCategoryChange={onCategoryChange}
              search={state.search}
              onSearchChange={onSearchChange}
              scanCode={state.scanCode}
              onScanCodeChange={onScanCodeChange}
              onAddService={onAddService}
              onAddByScanCode={onAddByScanCode}
              searchInputRef={searchInputRef}
              scannerInputRef={scannerInputRef}
              loading={state.loadingServices}
              scanningCode={state.scanningCode}
              scannerEnabled={state.scannerEnabled}
            />
          </SectionCard>
        </div>

        <SectionCard
          title="3. Cobro y emision"
          description="Revise el carrito y emita la factura institucional."
          className="lg:sticky lg:top-20 lg:h-fit lg:shrink-0"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-operational-border bg-operational-panel px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <ClipboardList className="size-3.5" aria-hidden="true" />
                Items
              </div>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{state.cartItems.length}</p>
            </div>
            <div className="rounded-md border border-secondary/25 bg-secondary/10 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Banknote className="size-3.5" aria-hidden="true" />
                Total
              </div>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{moneyLabel(preview.total)}</p>
            </div>
          </div>
          <div className="mt-4">
            <InvoiceCart
              items={state.cartItems}
              preview={preview}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateDialysisPrescription={onUpdateDialysisPrescription}
              onRemoveItem={onRemoveItem}
              onConfirm={onConfirm}
              disabled={state.submitting || !canEmit}
              disabledReasons={emitBlockReasons}
              actionLabel={canCreatePayments && canViewReceipts ? 'Emitir y cobrar' : 'Emitir factura'}
              emptyActionLabel="Agregue servicios"
              submitting={state.submitting}
              canMarkDialysisPrescription={props.canMarkDialysisPrescription}
            />
          </div>

          {hasCartItems ? (
            <div
              className="sticky bottom-0 -mx-panel mt-4 flex items-center justify-between gap-3 border-t border-operational-border bg-operational-surface px-3 py-3 shadow-command lg:hidden"
              data-testid="invoice-mobile-summary"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Total estimado
                </p>
                <p className="font-mono text-xl font-bold tabular-nums text-foreground">{moneyLabel(preview.total)}</p>
              </div>
              <Button
                type="button"
                disabled={state.submitting || !canEmit}
                onClick={onConfirm}
                aria-controls="nueva-factura"
              >
                {mobileActionLabel}
              </Button>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <InvoiceConfirmation
        open={state.showConfirmation}
        onOpenChange={onConfirmDialogChange}
        patientName={state.patientName}
        items={state.cartItems}
        preview={preview}
        cashSessionId={state.loadedCashSession?.id}
        onConfirm={onSubmitInvoice}
        submitting={state.submitting}
      />

      {state.issuedInvoice ? (
        <PaymentModal
          open={state.showPayment}
          onOpenChange={onPaymentOpenChange}
          invoiceNumber={state.issuedInvoice.invoice_number}
          patientName={state.issuedInvoice.patient_name}
          total={state.issuedInvoice.total}
          balanceDue={state.issuedInvoice.balance_due}
          paymentMethod={state.paymentMethod}
          paymentAmount={state.paymentAmount}
          paymentReference={state.paymentReference}
          previewBeforePrint={state.previewBeforePrint}
          partialPaymentsEnabled={state.partialPaymentsEnabled}
          onPaymentMethodChange={onPaymentMethodChange}
          onPaymentAmountChange={onPaymentAmountChange}
          onPaymentReferenceChange={onPaymentReferenceChange}
          onPreviewBeforePrintChange={onPreviewBeforePrintChange}
          onConfirm={onSubmitPayment}
          submitting={state.paying}
        />
      ) : null}

      {state.issuedInvoice ? (
        <InvoiceSuccess
          open={state.showSuccess}
          onOpenChange={onSuccessDialogChange}
          invoiceNumber={state.issuedInvoice.invoice_number}
          patientName={state.issuedInvoice.patient_name}
          total={state.issuedInvoice.total}
          status={state.issuedInvoice.status}
          onCobrar={onCobrar}
          onImprimir={onPrintIssuedReceipt}
          onNuevaFactura={onNuevaFactura}
        />
      ) : null}

      <Dialog
        open={state.showReceipt && Boolean(state.receipt)}
        onOpenChange={onReceiptOpenChange}
        size="lg"
        title="Comprobante de factura"
        description="Formato de compatibilidad para facturas antiguas o cuando el PDF institucional no esta disponible."
      >
        {state.receipt ? (
          <ReceiptPreview
            autoPrint={state.autoPrintReceipt}
            receipt={state.receipt}
            onWidthChange={onLoadReceipt}
            onNewInvoice={onNuevaFactura}
            onPrint={() => onAutoPrintChange(false)}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={state.showClearConfirm}
        title="Limpiar factura en curso"
        confirmLabel="Limpiar"
        cancelLabel="Seguir editando"
        onCancel={() => onClearConfirmChange(false)}
        onConfirm={() => {
          onClearConfirmChange(false);
          onClearCart();
        }}
      >
        Se borraran paciente, busqueda y servicios agregados. Use esta accion solo si quiere empezar de nuevo.
      </ConfirmDialog>
    </section>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
