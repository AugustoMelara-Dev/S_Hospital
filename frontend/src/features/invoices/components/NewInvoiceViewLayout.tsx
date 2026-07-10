import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Eraser, History } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { PatientStep } from './PatientStep';
import { ServiceSearch } from './ServiceSearch';
import { InvoiceCart } from './InvoiceCart';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import { PaymentModal } from './PaymentModal';
import { InvoiceSuccess } from './InvoiceSuccess';
import type { Payment, Service } from '../../../lib/api';
import type { NewInvoiceState } from '../state/types';

export type NewInvoiceLayoutProps = {
  state: NewInvoiceState;
  paymentResult?: Pick<Payment, 'method' | 'paid_at'> | null;
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
  onSubmitInvoice: () => void;
  onCobrar: () => void;
  onRetryLoad: () => void;
  onPaymentOpenChange: (val: boolean) => void;
  onSubmitPayment: (appliedAmount: string) => void;
  onPrintIssuedReceipt: () => void;
  onSaveIssuedReceiptPdf?: () => void;
  onNuevaFactura: () => void;
  onSuccessDialogChange: (val: boolean) => void;
  onReceiptOpenChange: (val: boolean) => void;
  onClearCart: () => void;
  onClearConfirmChange: (val: boolean) => void;
  patientInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scannerInputRef: RefObject<HTMLInputElement | null>;
};

export function NewInvoiceViewLayout(props: NewInvoiceLayoutProps) {
  const {
    state,
    paymentResult,
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
    onSubmitInvoice,
    onCobrar,
    onRetryLoad,
    onPaymentOpenChange,
    onSubmitPayment,
    onPrintIssuedReceipt,
    onSaveIssuedReceiptPdf,
    onNuevaFactura,
    onSuccessDialogChange,
    onReceiptOpenChange,
    onClearCart,
    onClearConfirmChange,
    patientInputRef,
    searchInputRef,
    scannerInputRef,
  } = props;
  const cashIsOpen = Boolean(state.loadedCashSession);
  const cashSessionLabel = state.loadedCashSession ? `Caja #${state.loadedCashSession.id}` : 'Caja cerrada';
  const postedPayments = state.issuedInvoice?.payments?.filter((payment) => payment.status === 'posted') ?? [];
  const latestPayment = paymentResult ?? postedPayments[postedPayments.length - 1];
  const [mobileStep, setMobileStep] = useState<0 | 1 | 2>(0);
  const patientRegionRef = useRef<HTMLElement | null>(null);
  const servicesRegionRef = useRef<HTMLElement | null>(null);
  const ticketRegionRef = useRef<HTMLElement | null>(null);
  const hasChangedStepRef = useRef(false);
  const stepLabels = ['Paciente', 'Servicios', 'Cuenta'] as const;

  useEffect(() => {
    if (!hasChangedStepRef.current) return;

    const stepRegion = [patientRegionRef, servicesRegionRef, ticketRegionRef][mobileStep];
    window.setTimeout(() => stepRegion.current?.focus(), 0);
  }, [mobileStep]);

  function goToStep(nextStep: 0 | 1 | 2) {
    hasChangedStepRef.current = true;
    setMobileStep(nextStep);
  }

  function continueMobileFlow() {
    if (mobileStep === 0) {
      onPatientSubmit();
      if (state.patientName.trim() === '') return;
      goToStep(1);
      return;
    }

    if (mobileStep === 1) {
      goToStep(2);
    }
  }

  return (
    <section id="nueva-factura" className="flex h-full min-w-0 flex-col gap-4 pb-36 md:pb-8">
      <header className="flex flex-col gap-3 border-b border-operational-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Facturación</p>
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Nueva factura</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={cashIsOpen ? 'success' : 'destructive'} className="min-h-11 px-3 font-mono text-sm tabular-nums sm:min-h-9">
            {cashIsOpen ? `${cashSessionLabel} · Abierta` : cashSessionLabel}
          </Badge>
          <Button asChild type="button" variant="secondary" size="sm">
            <Link to="/invoices">
              <History className="size-4" aria-hidden="true" />
              Historial
            </Link>
          </Button>
          {(state.patientName || state.cartItems.length > 0) ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onClearConfirmChange(true)}>
              <Eraser className="size-4" aria-hidden="true" />
              Limpiar borrador
            </Button>
          ) : null}
        </div>
      </header>

      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
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
      </div>

      <div className="md:hidden" aria-live="polite">
        <div className="flex items-center justify-between gap-3 border-y border-operational-border py-3">
          <p className="text-sm font-semibold">Paso {mobileStep + 1} de 3</p>
          <p className="text-sm text-muted-foreground">{stepLabels[mobileStep]}</p>
        </div>
      </div>

      <div
        data-billing-workspace
        className="grid min-w-0 flex-1 gap-0 md:grid-cols-[minmax(15rem,0.72fr)_minmax(24rem,1.45fr)] xl:grid-cols-[minmax(15rem,0.72fr)_minmax(24rem,1.45fr)_minmax(19rem,0.83fr)]"
      >
        <section
          ref={patientRegionRef}
          aria-label="Paciente"
          data-billing-region="patient"
          data-billing-step="patient"
          tabIndex={-1}
          className={`${mobileStep === 0 ? 'block' : 'hidden'} min-w-0 border-operational-border pb-5 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:block md:border-r md:pb-0 md:pr-5`}
        >
          <PatientStep
            ref={patientInputRef}
            patientName={state.patientName}
            onPatientNameChange={onPatientNameChange}
            onPatientSubmit={onPatientSubmit}
            error={state.patientError}
          />
        </section>

        <section
          ref={servicesRegionRef}
          aria-label="Servicios"
          data-billing-region="services"
          data-billing-step="services"
          tabIndex={-1}
          className={`${mobileStep === 1 ? 'block' : 'hidden'} min-w-0 border-operational-border py-5 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:block md:py-0 md:pl-5 xl:border-r xl:pr-5`}
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
            error={state.pointOfSaleLoadError ?? undefined}
            onRetry={onRetryLoad}
          />
        </section>

        <aside
          ref={ticketRegionRef}
          aria-label="Cuenta actual"
          data-billing-region="ticket"
          data-billing-step="review"
          tabIndex={-1}
          className={`${mobileStep === 2 ? 'block' : 'hidden'} min-w-0 border-t border-operational-border pt-5 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:col-span-2 md:block xl:sticky xl:top-20 xl:col-span-1 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:border-t-0 xl:pl-5 xl:pt-0`}
        >
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
        </aside>
      </div>

      <nav aria-label="Pasos de facturación" className="fixed inset-x-0 bottom-16 z-30 border-t border-operational-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg gap-3">
          {mobileStep > 0 ? (
            <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={() => goToStep((mobileStep - 1) as 0 | 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
          ) : null}
          {mobileStep < 2 ? (
            <Button
              type="button"
              className="min-h-11 flex-1"
              aria-label={mobileStep === 0 ? 'Continuar a servicios' : 'Continuar a cuenta'}
              onClick={continueMobileFlow}
            >
              Continuar
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </nav>

      <InvoiceConfirmation
        open={state.showConfirmation}
        onOpenChange={onConfirmDialogChange}
        patientName={state.patientName}
        items={state.cartItems}
        preview={preview}
        cashSessionId={state.loadedCashSession?.id}
        canOpenPayment={canCreatePayments && canViewReceipts}
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
          partialPaymentsEnabled={state.partialPaymentsEnabled}
          onPaymentMethodChange={onPaymentMethodChange}
          onPaymentAmountChange={onPaymentAmountChange}
          onPaymentReferenceChange={onPaymentReferenceChange}
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
          canCollectPayment={canCreatePayments && canViewReceipts}
          canPrintReceipt={canViewReceipts && Boolean(state.institutionalReceipt || state.receipt)}
          canSavePdf={canViewReceipts && Boolean(state.institutionalReceipt) && Boolean(onSaveIssuedReceiptPdf)}
          receiptRecoveryMessage={state.institutionalReceiptRecoveryMessage ?? undefined}
          paymentMethod={latestPayment?.method ?? (state.issuedInvoice.status === 'paid' ? state.paymentMethod : undefined)}
          paymentDate={latestPayment?.paid_at}
          onCobrar={onCobrar}
          onImprimir={onPrintIssuedReceipt}
          onGuardarPdf={onSaveIssuedReceiptPdf}
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
            receipt={state.receipt}
            onNewInvoice={onNuevaFactura}
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
