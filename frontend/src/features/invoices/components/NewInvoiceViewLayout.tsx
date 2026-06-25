import { Link } from 'react-router-dom';
import type { RefObject } from 'react';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Dialog } from '../../../components/ui/dialog';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
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
  const mobileBlockedReason = emitBlockReasons[0];

  return (
    <section id="nueva-factura" className="flex h-full flex-col gap-4 pb-28 lg:pb-0">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Sistema institucional</p>
          <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">Nueva factura</h1>
          <p className="text-sm text-muted-foreground">Paciente, servicios, cobro y recibo en una sola estacion.</p>
        </div>
        <div className="flex items-center gap-3">
          {state.loadedCashSession ? (
            <Badge variant="success" className="font-mono text-sm tabular-nums">
              Caja #{state.loadedCashSession.id} - Abierta
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm">
              Caja cerrada
            </Badge>
          )}
        </div>
      </header>

      {state.pointOfSaleLoadError && (
        <Alert variant="destructive" title="No se pudo cargar el punto de venta">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex-1">{state.pointOfSaleLoadError}</span>
            <Button type="button" variant="secondary" size="sm" onClick={onRetryLoad} disabled={state.loadingServices}>
              {state.loadingServices ? 'Reintentando...' : 'Reintentar'}
            </Button>
          </div>
        </Alert>
      )}

      {!state.loadedCashSession && !state.pointOfSaleLoadError && (
        <Alert variant="warning" title="Caja no abierta">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="flex-1">Debe abrir la caja antes de emitir facturas.</span>
            {canOpenCash && onOpenCash ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                Abrir Caja
              </Button>
            ) : (
              <div className="flex flex-col gap-1 sm:items-end">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/cashbox">Ir a caja</Link>
                </Button>
                {!canOpenCash ? (
                  <span className="text-xs text-muted-foreground">Solicite apertura a un usuario autorizado.</span>
                ) : null}
              </div>
            )}
          </div>
        </Alert>
      )}

      {state.alertMessage && state.alertMessage !== state.pointOfSaleLoadError && (
        <Alert variant="destructive" title="Revise antes de continuar">
          {state.alertMessage}
        </Alert>
      )}

      {state.warningMessage && (
        <Alert variant="warning" title="Factura pendiente">
          {state.warningMessage}
        </Alert>
      )}

      {state.successMessage && (
        <Alert variant="success" title="Servicio agregado">
          {state.successMessage.replace(/^Agregado: /, '')}
        </Alert>
      )}

      {hasCartItems ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                {state.cartItems.length} servicio{state.cartItems.length === 1 ? '' : 's'} en factura
              </p>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-mono text-lg font-bold tabular-nums text-secondary">{moneyLabel(preview.total)}</span>
              </p>
              {mobileBlockedReason ? (
                <p className="mt-0.5 truncate text-xs text-warning-foreground">{mobileBlockedReason}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={state.submitting || !canEmit}
              onClick={onConfirm}
            >
              {mobileActionLabel}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          <Card className="border-secondary/20 bg-card/95 lg:shrink-0">
            <CardContent className="pt-5">
              <PatientStep
                ref={patientInputRef}
                patientName={state.patientName}
                onPatientNameChange={onPatientNameChange}
                onPatientSubmit={onPatientSubmit}
                error={state.patientError}
              />
            </CardContent>
          </Card>

          <Card className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <CardContent className="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
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
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-20 lg:h-fit lg:shrink-0">
          <CardContent className="pt-5">
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
          </CardContent>
        </Card>
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

      {state.issuedInvoice && (
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
      )}

      {state.issuedInvoice && (
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
      )}

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
        Se borrarán paciente, búsqueda y servicios agregados. Use esta acción solo si quiere empezar de nuevo.
      </ConfirmDialog>
    </section>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
