import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { LeftOutlined as ChevronLeft, RightOutlined as ChevronRight, ClearOutlined as Eraser, HistoryOutlined as History } from '@ant-design/icons';
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
    <section id="nueva-factura" className="flex h-full min-w-0 flex-col gap-5 pb-36 md:pb-8">
      <header className="relative overflow-hidden border border-border bg-surface px-5 py-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground">Operaciones financieras</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">Nueva factura</h1>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
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
        </div>
      </header>

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

      <div aria-live="polite" className="mx-auto w-full max-w-5xl">
        <ol className="grid grid-cols-3 overflow-hidden border border-border bg-white">
          {stepLabels.map((label, index) => (
            <li key={label} className="min-w-0 border-r border-border last:border-r-0">
              <Button type="text" aria-current={mobileStep === index ? 'step' : undefined} onClick={() => index <= mobileStep ? goToStep(index as 0 | 1 | 2) : undefined} disabled={index > mobileStep} className={`h-auto min-h-14 w-full min-w-0 justify-start gap-2 px-3 py-3 text-left sm:px-4 ${mobileStep === index ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                <span className={`flex size-8 shrink-0 items-center justify-center text-xs font-bold ${mobileStep === index ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span>
                <span className="truncate text-xs font-semibold sm:text-sm">{label}</span>
              </Button>
            </li>
          ))}
        </ol>
      </div>

      <div
        data-billing-workspace
        className="mx-auto grid w-full max-w-5xl min-w-0 flex-1 gap-4"
      >
        <section
          ref={patientRegionRef}
          aria-label="Paciente"
          data-billing-region="patient"
          data-billing-step="patient"
          aria-hidden={mobileStep !== 0}
          inert={mobileStep !== 0}
          tabIndex={-1}
          className={`${mobileStep === 0 ? 'block' : 'hidden'} min-w-0 border border-operational-border bg-operational-surface p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-7`}
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
          aria-hidden={mobileStep !== 1}
          inert={mobileStep !== 1}
          tabIndex={-1}
          className={`${mobileStep === 1 ? 'block' : 'hidden'} min-w-0 border border-operational-border bg-operational-surface p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-7`}
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
          aria-hidden={mobileStep !== 2}
          inert={mobileStep !== 2}
          tabIndex={-1}
          className={`${mobileStep === 2 ? 'block' : 'hidden'} min-w-0 border border-secondary/25 bg-accent/25 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-7`}
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

      <nav aria-label="Pasos de facturación" className="fixed inset-x-0 bottom-16 z-30 border-t border-operational-border bg-background p-3 md:static md:mx-auto md:w-full md:max-w-5xl md:border md:bg-white">
        <div className="mx-auto flex max-w-2xl gap-3 md:justify-end">
          {mobileStep > 0 ? (
            <Button type="default" className="min-h-11 flex-1 flex items-center justify-center gap-1" onClick={() => goToStep((mobileStep - 1) as 0 | 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
          ) : null}
          {mobileStep < 2 ? (
            <Button
              type="primary"
              className="min-h-11 flex-1 flex items-center justify-center gap-1"
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
