import { Link } from 'react-router-dom';
import type { RefObject } from 'react';
import { Banknote, ClipboardList } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Dialog } from '../../../components/ui/dialog';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { CashStatusCard, OperationalBanner } from '../../../components/shared/design-system';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { PatientStep } from './PatientStep';
import { ServiceSearch } from './ServiceSearch';
import { InvoiceCart } from './InvoiceCart';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import { PaymentModal } from './PaymentModal';
import { InvoiceSuccess } from './InvoiceSuccess';
import type { Payment, Service } from '../../../lib/api';
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
  onSubmitInvoice: () => void;
  onCobrar: () => void;
  onRetryLoad: () => void;
  onPaymentOpenChange: (val: boolean) => void;
  onSubmitPayment: (appliedAmount: string) => void;
  onPrintIssuedReceipt: () => void;
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

  return (
    <section id="nueva-factura" className="flex h-full flex-col gap-4 pb-28 lg:pb-0">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <OperationalBanner
          className="border-hospital-primary/25 bg-[linear-gradient(135deg,var(--color-operational-surface),var(--color-accent))]"
          meta="Punto de venta hospitalario"
          title="Nueva factura"
          description="Registre paciente, agregue servicios facturables y continue al cobro institucional sin salir del flujo de caja."
          status={
            <Badge variant={cashIsOpen ? 'success' : 'destructive'} className="font-mono text-sm tabular-nums">
              {cashIsOpen ? `${cashSessionLabel} - Abierta` : cashSessionLabel}
            </Badge>
          }
        />
        <CashStatusCard
          status={cashIsOpen ? 'open' : 'attention'}
          amount={cashSessionLabel}
          label="Operacion de caja"
          helper={cashIsOpen ? 'Lista para emitir y cobrar facturas.' : 'Debe abrir caja antes de emitir facturas.'}
          actions={!cashIsOpen && canOpenCash && onOpenCash ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                Abrir Caja
              </Button>
          ) : null}
        />
      </div>

      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
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
      </div>

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          <Card className="border-secondary/25 bg-operational-surface shadow-operational lg:shrink-0">
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

          <Card className="border-operational-border bg-operational-surface shadow-operational lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
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

        <Card className="border-operational-border bg-operational-surface shadow-operational lg:sticky lg:top-20 lg:h-fit lg:shrink-0">
          <CardContent className="pt-5">
            <div className="mb-4 grid grid-cols-2 gap-2">
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
          receiptRecoveryMessage={state.institutionalReceiptRecoveryMessage ?? undefined}
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

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}
