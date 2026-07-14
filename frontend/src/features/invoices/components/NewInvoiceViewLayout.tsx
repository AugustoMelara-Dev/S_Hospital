import { useNavigate } from 'react-router-dom';
import { type RefObject, useRef } from 'react';
import { ClearOutlined as Eraser, HistoryOutlined as History } from '@ant-design/icons';
import { Alert, Button, Modal, Tag } from 'antd';
import { ReceiptPreview } from '../../receipts/ReceiptPreview';
import { PatientStep } from './PatientStep';
import { ServiceSearch } from './ServiceSearch';
import { InvoiceCart } from './InvoiceCart';
import { InvoiceConfirmation } from './InvoiceConfirmation';
import { PaymentModal } from './PaymentModal';
import { InvoiceSuccess } from './InvoiceSuccess';
import type { Payment, Service } from '../../../lib/api';
import type { NewInvoiceState } from '../state/types';
import { PageHeader } from '@/design-system/components/PageHeader';

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
  const navigate = useNavigate();
  const confirmLockRef = useRef(false);
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
  const requestConfirmation = () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    onConfirm();
    window.setTimeout(() => {
      confirmLockRef.current = false;
    }, 300);
  };
  return (
    <section id="nueva-factura" className="flex h-full min-w-0 flex-col gap-5 pb-24 xl:pb-8">
      <PageHeader
        eyebrow="Operaciones financieras"
        title="Nueva factura"
        actions={(
          <>
          <Tag color={cashIsOpen ? 'success' : 'error'} className="min-h-11 px-3 font-mono text-sm tabular-nums sm:min-h-9 flex items-center border-0 m-0">
            {cashIsOpen ? `${cashSessionLabel} · Abierta` : cashSessionLabel}
          </Tag>
          <Button type="default" icon={<History aria-hidden="true" />} onClick={() => navigate('/invoices')}>
            Historial
          </Button>
          {(state.patientName || state.cartItems.length > 0) ? (
            <Button type="text" onClick={() => onClearConfirmChange(true)} className="flex items-center gap-2">
              <Eraser className="size-4" aria-hidden="true" />
              Limpiar borrador
            </Button>
          ) : null}
          </>
        )}
      />

      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
        {!state.loadedCashSession && !state.pointOfSaleLoadError && (
          <Alert type="warning" showIcon title="Caja no abierta" description={
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="flex-1">Debe abrir la caja antes de emitir facturas.</span>
              {canOpenCash && onOpenCash ? (
                <Button type="default" onClick={onOpenCash}>
                  Abrir Caja
                </Button>
              ) : (
                <div className="flex flex-col gap-1 sm:items-end">
                  <Button type="default" onClick={() => navigate('/cashbox')}>Ir a caja</Button>
                  {!canOpenCash ? (
                    <span className="text-xs text-muted-foreground">Solicite apertura a un usuario autorizado.</span>
                  ) : null}
                </div>
              )}
            </div>
          } />
        )}

        {state.alertMessage && state.alertMessage !== state.pointOfSaleLoadError && (
          <Alert type="error" showIcon title="Revise antes de continuar" description={state.alertMessage} />
        )}

        {state.warningMessage && (
          <Alert type="warning" showIcon title="Factura pendiente" description={state.warningMessage} />
        )}

        {state.successMessage && (
          <Alert type="success" showIcon title="Servicio agregado" description={state.successMessage.replace(/^Agregado: /, '')} />
        )}
      </div>

      <div
        data-billing-workspace
        className="grid w-full min-w-0 flex-1 gap-4 xl:grid-cols-5 xl:items-start"
      >
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
          <section aria-label="Paciente" data-billing-region="patient" className="min-w-0 border border-operational-border bg-operational-surface p-5 sm:p-6">
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
            />
          </section>
        </div>

        <aside
          aria-label="Cuenta actual"
          data-billing-region="ticket"
          data-billing-cart-sticky
          className="min-w-0 border border-secondary/25 bg-accent/25 p-5 xl:col-span-2 xl:sticky xl:top-20 xl:max-h-160 xl:overflow-y-auto"
        >
          <InvoiceCart
            items={state.cartItems}
            preview={preview}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateDialysisPrescription={onUpdateDialysisPrescription}
            onRemoveItem={onRemoveItem}
            onConfirm={requestConfirmation}
            disabled={state.submitting || !canEmit}
            disabledReasons={emitBlockReasons}
            actionLabel={canCreatePayments && canViewReceipts ? 'Emitir y cobrar' : 'Emitir factura'}
            emptyActionLabel="Agregue servicios"
            submitting={state.submitting}
            canMarkDialysisPrescription={props.canMarkDialysisPrescription}
          />
        </aside>
      </div>

      {state.cartItems.length > 0 ? (
        <div data-billing-mobile-summary className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-operational-border bg-operational-surface p-3 xl:hidden">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Total estimado</span>
            <strong className="block font-mono text-lg tabular-nums text-foreground">L {preview.total}</strong>
          </div>
          <Button
            type="primary"
            disabled={state.submitting || !canEmit}
            aria-label={`Confirmar cuenta móvil, total L ${preview.total}`}
            onClick={requestConfirmation}
          >
            {state.submitting ? 'Emitiendo...' : canCreatePayments && canViewReceipts ? 'Emitir y cobrar' : 'Emitir factura'}
          </Button>
        </div>
      ) : null}

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

      <Modal
        open={state.showReceipt && Boolean(state.receipt)}
        onCancel={() => onReceiptOpenChange(false)}
        title="Comprobante de factura"
        footer={null}
        width={760}
        destroyOnHidden
      >
        <p className="text-sm text-muted-foreground mb-4">
          Formato de compatibilidad para facturas antiguas o cuando el PDF institucional no esta disponible.
        </p>
        {state.receipt ? (
          <ReceiptPreview
            receipt={state.receipt}
            onNewInvoice={onNuevaFactura}
          />
        ) : null}
      </Modal>

      <Modal
        open={state.showClearConfirm}
        title="Limpiar factura en curso"
        okText="Limpiar"
        cancelText="Seguir editando"
        onCancel={() => onClearConfirmChange(false)}
        onOk={() => {
          onClearConfirmChange(false);
          onClearCart();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Se borraran paciente, busqueda y servicios agregados. Use esta accion solo si quiere empezar de nuevo.
        </p>
      </Modal>
    </section>
  );
}
