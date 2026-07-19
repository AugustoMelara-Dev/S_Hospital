import { useNavigate } from 'react-router-dom';
import { type RefObject, useRef, useState } from 'react';
import { EraserIcon as Eraser, HistoryIcon as History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { InstitutionalReceiptPreviewFrame } from '../../receipts/InstitutionalReceiptPreviewFrame';
import { PatientStep } from './PatientStep';
import { ServiceSearch } from './ServiceSearch';
import { InvoiceCart } from './InvoiceCart';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import { PaymentModal } from './PaymentModal';
import { InvoiceSuccess } from './InvoiceSuccess';
import type { Payment, Service } from '../../../lib/api';
import type { NewInvoiceState } from '../state/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BillingAccountDrawer } from './BillingAccountDrawer';
import { BillingBottomBar } from './BillingBottomBar';

export type NewInvoiceLayoutProps = {
  state: NewInvoiceState;
  paymentResult?: Pick<Payment, 'method' | 'paid_at'> | null;
  preview: { subtotal: string; exempt?: string; tax: string; total: string };
  defaultTaxRate?: string;
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
  onLoadMoreServices?: () => void;
  onPaymentOpenChange: (val: boolean) => void;
  onSubmitPayment: (appliedAmount: string) => void;
  onPrintIssuedReceipt: () => void;
  onViewIssuedReceipt?: () => void;
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
  const navigate = useNavigate();
  const confirmLockRef = useRef(false);
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const [accountOpen, setAccountOpen] = useState(false);
  const {
    state,
    paymentResult,
    preview,
    defaultTaxRate,
    emitBlockReasons,
    canEmit,
    canCreatePayments,
    canOpenCash,
    canViewReceipts,
    canMarkDialysisPrescription = false,
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
    onLoadMoreServices = () => undefined,
    onPaymentOpenChange,
    onSubmitPayment,
    onPrintIssuedReceipt,
    onViewIssuedReceipt,
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
  const postedPayments = state.issuedInvoice?.payments?.filter((payment) => payment.status === 'posted') ?? [];
  const latestPayment = paymentResult ?? postedPayments[postedPayments.length - 1];
  const confirmationItems = canMarkDialysisPrescription
    ? state.cartItems
    : state.cartItems.map((item) => ({ ...item, dialysisPrescription: false }));
  const requestConfirmation = () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    setAccountOpen(false);
    onConfirm();
    window.setTimeout(() => {
      confirmLockRef.current = false;
    }, 300);
  };
  const closeAccount = () => {
    setAccountOpen(false);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-billing-account-trigger]')?.focus();
    }, 0);
  };
  const startNewInvoice = () => {
    setAccountOpen(false);
    onNuevaFactura();
  };
  const account = (
    <InvoiceCart
      items={state.cartItems}
      preview={preview}
      taxRate={defaultTaxRate}
      onUpdateQuantity={onUpdateQuantity}
      onUpdateDialysisPrescription={onUpdateDialysisPrescription}
      onRemoveItem={onRemoveItem}
      onConfirm={requestConfirmation}
      disabled={state.submitting || !canEmit}
      disabledReasons={emitBlockReasons}
      actionLabel={canCreatePayments && canViewReceipts ? 'Emitir y cobrar' : 'Emitir factura'}
      emptyActionLabel="Agregue servicios"
      submitting={state.submitting}
      canMarkDialysisPrescription={canMarkDialysisPrescription}
    />
  );
  return (
    <section id="nueva-factura" className={`flex h-full min-w-0 flex-col gap-4 ${isDesktop ? 'pb-8' : 'pb-28'}`}>
      <div className="flex min-h-9 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Facturación</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva factura</h1>
          <p className="text-sm text-muted-foreground">Identifique al paciente, agregue servicios y cobre desde una sola estación.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Acciones de facturación">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            <History aria-hidden="true" />Historial
          </Button>
          {(state.patientName || state.cartItems.length > 0) ? (
            <Button type="button" variant="ghost" onClick={() => onClearConfirmChange(true)} className="flex items-center gap-2">
              <Eraser className="size-4" aria-hidden="true" />
              Limpiar borrador
            </Button>
          ) : null}
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
        {!state.loadedCashSession && !state.pointOfSaleLoadError && (
          <Alert><AlertTitle>Caja no abierta</AlertTitle><AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="flex-1">Debe abrir la caja antes de emitir facturas.</span>
              {canOpenCash && onOpenCash ? (
                <Button type="button" variant="outline" onClick={onOpenCash}>
                  Abrir Caja
                </Button>
              ) : (
                <div className="flex flex-col gap-1 sm:items-end">
                  <Button type="button" variant="outline" onClick={() => navigate('/cashbox')}>Ir a caja</Button>
                  {!canOpenCash ? (
                    <span className="text-xs text-muted-foreground">Solicite apertura a un usuario autorizado.</span>
                  ) : null}
                </div>
              )}
            </div></AlertDescription></Alert>
        )}

        {state.alertMessage && state.alertMessage !== state.pointOfSaleLoadError && (
          <StatusAlert destructive title="Revise antes de continuar" description={state.alertMessage} />
        )}

        {state.warningMessage && (
          <StatusAlert title="Factura pendiente" description={state.warningMessage} />
        )}

        {state.successMessage && (
          <StatusAlert title={`Servicio agregado: ${state.successMessage.replace(/^Agregado: /, '')}`} />
        )}
      </div>

      <div
        data-billing-workspace
        className="billing-workspace-grid grid w-full min-w-0 flex-1 gap-4 xl:items-start"
      >
        <div data-audit-panel="billing-main" className="flex min-w-0 flex-col gap-4">
          <section aria-label="Paciente" data-billing-region="patient" className="min-w-0 border border-operational-border bg-operational-surface p-3 sm:p-4">
            <PatientStep
              ref={patientInputRef}
              patientName={state.patientName}
              onPatientNameChange={onPatientNameChange}
              onPatientSubmit={onPatientSubmit}
              error={state.patientError}
            />
          </section>

          <section aria-label="Servicios" data-billing-region="services" className="min-w-0">
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
              cartItems={state.cartItems}
              hasMore={state.hasMoreServices}
              loadingMore={state.loadingMoreServices}
              onLoadMore={onLoadMoreServices}
            />
          </section>
        </div>

        {isDesktop ? (
          <aside
            aria-label="Cuenta actual"
            data-testid="billing-account-desktop"
            data-audit-panel="billing-account"
            data-billing-region="ticket"
            data-billing-cart-sticky
            className="billing-account-desktop billing-account-viewport min-w-0 self-start overflow-hidden border border-secondary/25 bg-accent/25 p-5 xl:sticky xl:top-20"
          >
            {account}
          </aside>
        ) : null}
      </div>

      {!isDesktop ? (
        <>
          <BillingBottomBar itemCount={state.cartItems.length} total={preview.total} onOpen={() => setAccountOpen(true)} />
          <BillingAccountDrawer open={accountOpen} onClose={closeAccount}>{account}</BillingAccountDrawer>
        </>
      ) : null}

      <InvoiceConfirmation
        open={state.showConfirmation}
        onOpenChange={onConfirmDialogChange}
        patientName={state.patientName}
        items={confirmationItems}
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
          errorMessage={state.paymentError}
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
          receivedAmount={state.completedPaymentReceivedAmount}
          changeAmount={state.completedPaymentChangeAmount}
          onCobrar={onCobrar}
          onVerRecibo={onViewIssuedReceipt}
          onImprimir={onPrintIssuedReceipt}
          onGuardarPdf={onSaveIssuedReceiptPdf}
          onNuevaFactura={startNewInvoice}
        />
      )}

      <Dialog open={state.showReceipt && Boolean(state.institutionalReceipt || state.receipt)} onOpenChange={onReceiptOpenChange}>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Comprobante de factura</DialogTitle><DialogDescription>Vista previa exacta del documento disponible para impresión.</DialogDescription></DialogHeader>
        {state.institutionalReceipt ? (
          <InstitutionalReceiptPreviewFrame
            receiptId={state.institutionalReceipt.id}
            receiptNumber={state.institutionalReceipt.receipt_number_full}
          />
        ) : state.receipt ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Formato de compatibilidad para facturas antiguas o cuando el PDF institucional no esta disponible.
            </p>
          <ReceiptPreview
            receipt={state.receipt}
            onNewInvoice={onNuevaFactura}
          />
          </>
        ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={state.showClearConfirm} onOpenChange={onClearConfirmChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Limpiar factura en curso</AlertDialogTitle><AlertDialogDescription>Se borrarán paciente, búsqueda y servicios agregados. Use esta acción solo si quiere empezar de nuevo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={() => { onClearConfirmChange(false); onClearCart(); }}>Limpiar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}

function StatusAlert({ title, description, destructive = false }: { title: string; description?: string; destructive?: boolean }) {
  return <Alert variant={destructive ? 'destructive' : 'default'} className="py-2"><AlertTitle>{title}</AlertTitle>{description ? <AlertDescription>{description}</AlertDescription> : null}</Alert>;
}
