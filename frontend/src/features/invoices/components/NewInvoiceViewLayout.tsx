import { useNavigate } from 'react-router-dom';
import { type RefObject, useRef, useState } from 'react';
import { ClearOutlined as Eraser, HistoryOutlined as History } from '@ant-design/icons';
import { Alert, Button, Modal } from 'antd';
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
  const requestConfirmation = () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
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
      canMarkDialysisPrescription={props.canMarkDialysisPrescription}
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
        <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Acciones de facturación">
          <Button type="default" icon={<History aria-hidden="true" />} onClick={() => navigate('/invoices')}>
            Historial
          </Button>
          {(state.patientName || state.cartItems.length > 0) ? (
            <Button type="text" onClick={() => onClearConfirmChange(true)} className="flex items-center gap-2">
              <Eraser className="size-4" aria-hidden="true" />
              Limpiar borrador
            </Button>
          ) : null}
        </div>
      </div>

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
          <Alert
            type="success"
            showIcon
            className="py-2"
            title={`Servicio agregado: ${state.successMessage.replace(/^Agregado: /, '')}`}
          />
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
          onNuevaFactura={onNuevaFactura}
        />
      )}

      <Modal
        open={state.showReceipt && Boolean(state.institutionalReceipt || state.receipt)}
        onCancel={() => onReceiptOpenChange(false)}
        title="Comprobante de factura"
        footer={null}
        width={760}
        destroyOnHidden
      >
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
