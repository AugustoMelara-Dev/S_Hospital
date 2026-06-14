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

export type NewInvoiceLayoutProps = {
  state: NewInvoiceState;
  preview: { subtotal: string; tax: string; total: string };
  emitBlockReasons: string[];
  canEmit: boolean;
  canCreatePayments: boolean;
  canViewReceipts: boolean;
  onOpenCash?: () => void;
  onPatientNameChange: (value: string) => void;
  onPatientSubmit: () => void;
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
  onPreviewBeforePrintChange: (val: boolean) => void;
  onSubmitInvoice: () => void;
  onCobrar: () => void;
  onPaymentOpenChange: (val: boolean) => void;
  onSubmitPayment: (appliedAmount: string) => void;
  onLoadReceipt: (width: ReceiptData['width']) => void;
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
    canViewReceipts,
    onOpenCash,
    onPatientNameChange,
    onPatientSubmit,
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
    onPreviewBeforePrintChange,
    onSubmitInvoice,
    onCobrar,
    onPaymentOpenChange,
    onSubmitPayment,
    onLoadReceipt,
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

  return (
    <section id="nueva-factura" className="flex flex-col h-full gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-primary">Caja hospitalaria</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Nueva factura</h1>
          <p className="text-sm text-muted-foreground">Factura y cobro en caja</p>
        </div>
        <div className="flex items-center gap-3">
          {state.loadedCashSession ? (
            <Badge variant="default" className="text-sm">
              Caja #{state.loadedCashSession.id} - Abierta
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm">
              Caja cerrada
            </Badge>
          )}
        </div>
      </header>

      {!state.loadedCashSession && (
        <Alert variant="warning" title="Caja no abierta">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="flex-1">Debe abrir la caja antes de emitir facturas.</span>
            {onOpenCash ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCash}>
                Abrir Caja
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link to="/cashbox">Ir a caja</Link>
              </Button>
            )}
          </div>
        </Alert>
      )}

      {state.alertMessage && (
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

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_380px] lg:min-h-0">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          <Card className="lg:shrink-0">
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

          <Card className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
            <CardContent className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              <ServiceSearch
                categories={state.categories}
                services={state.services}
                selectedCategoryId={state.selectedCategoryId}
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
                scannerEnabled={state.scannerEnabled}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:h-fit lg:shrink-0">
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
          previewBeforePrint={state.previewBeforePrint}
          partialPaymentsEnabled={state.partialPaymentsEnabled}
          onPaymentMethodChange={onPaymentMethodChange}
          onPaymentAmountChange={onPaymentAmountChange}
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
          onImprimir={() => onLoadReceipt(state.receiptWidth)}
          onNuevaFactura={onNuevaFactura}
        />
      )}

      <Dialog
        open={state.showReceipt && Boolean(state.receipt)}
        onOpenChange={onReceiptOpenChange}
        size="lg"
        title="Vista previa del recibo"
        description="Vista previa institucional lista para imprimir."
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
