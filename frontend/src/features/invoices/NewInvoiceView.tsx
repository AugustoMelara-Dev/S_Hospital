import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { PatientStep } from './components/PatientStep';
import { ServiceSearch } from './components/ServiceSearch';
import { InvoiceCart, type CartItem } from './components/InvoiceCart';
import { InvoiceConfirmation } from './components/InvoiceConfirmation';
import { PaymentModal } from './components/PaymentModal';
import { InvoiceSuccess } from './components/InvoiceSuccess';
import { type Category, type CashSession, type Invoice, type Payment, type ReceiptData, type Service, apiClient, userSafeErrorMessage } from '../../lib/api';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

type NewInvoiceViewProps = {
  cashSession: CashSession | null;
  canCreatePayments?: boolean;
  canViewCatalog?: boolean;
  canViewReceipts?: boolean;
  onCashSessionChange?: (session: CashSession | null) => void;
  onOpenCash?: () => void;
  onStatus: (message: string) => void;
};

export function NewInvoiceView({
  cashSession,
  canCreatePayments = true,
  canViewCatalog = true,
  canViewReceipts = true,
  onCashSessionChange,
  onOpenCash,
  onStatus,
}: NewInvoiceViewProps) {
  const [patientName, setPatientName] = useState('');
  const [patientError, setPatientError] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadedCashSession, setLoadedCashSession] = useState<CashSession | null>(cashSession);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all' | undefined>();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [issuedInvoice, setIssuedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('80mm');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [autoPrintReceiptKey, setAutoPrintReceiptKey] = useState<string | null>(null);
  const patientInputRef = useRef<HTMLInputElement | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const autoPrintedReceiptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void loadPointOfSaleData();
  }, []);

  useEffect(() => {
    if (cashSession) {
      setLoadedCashSession(cashSession);
    }
  }, [cashSession]);

  useEffect(() => {
    if (!receipt || !showReceipt || !autoPrintReceiptKey) return;
    if (autoPrintedReceiptKeyRef.current === autoPrintReceiptKey) return;

    autoPrintedReceiptKeyRef.current = autoPrintReceiptKey;
    const timer = window.setTimeout(() => {
      printReceiptDocument(receipt.width, () => window.print());
      onStatus(`Recibo ${receipt.invoice.invoice_number} enviado a impresion.`);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [autoPrintReceiptKey, onStatus, receipt, showReceipt]);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    setPatientName('');
    setPatientError(undefined);
    setAlertMessage(null);
    setSearch('');
    setScanCode('');
    setSelectedCategoryId(undefined);
    onStatus('Carrito limpiado.');
  }, [onStatus]);

  const canEmit = Boolean(loadedCashSession && patientName.trim() && cartItems.length > 0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        patientInputRef.current?.focus();
      }

      if (e.key === 'Escape') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (confirm('¿Limpiar carrito?')) {
          handleClearCart();
        }
      }

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (canEmit) {
          handleEmitClick();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEmit, handleClearCart]);

  const preview = useMemo(() => calculatePreview(cartItems), [cartItems]);

  async function loadPointOfSaleData() {
    if (!canViewCatalog) {
      setAlertMessage('Este usuario no tiene permiso para consultar el catalogo de servicios.');
      setLoadingServices(false);
      return;
    }

    setLoadingServices(true);

    try {
      const [currentCashSession, nextCategories, nextServices] = await Promise.all([
        apiClient.getCurrentCashSession(),
        apiClient.getCategories(true),
        apiClient.getServices({ active: true, perPage: 150 }),
      ]);
      setLoadedCashSession(currentCashSession);
      onCashSessionChange?.(currentCashSession);
      setCategories(Array.isArray(nextCategories) ? nextCategories : []);
      setServices(Array.isArray(nextServices) ? nextServices : []);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar servicios activos.'));
    } finally {
      setLoadingServices(false);
    }
  }

  function addToCart(service: Service) {
    setAlertMessage(null);
    setPatientError(undefined);
    setCartItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.service.id === service.id && !item.dialysisPrescription,
      );

      if (existingIndex === -1) {
        return [
          ...current,
          { service, quantity: '1', dialysisPrescription: false },
        ];
      }

      return current.map((item, idx) =>
        idx === existingIndex
          ? { ...item, quantity: incrementQuantity(item.quantity) }
          : item,
      );
    });
    setIssuedInvoice(null);
  }

  async function addByScanCode() {
    const code = scanCode.trim();

    if (code === '') {
      const message = 'Ingrese o escanee un codigo.';
      setAlertMessage(message);
      onStatus(message);
      return;
    }

    try {
      const [service] = await apiClient.getServices({ active: true, code, perPage: 1 });

      if (!service) {
        const localMatch = services.find((s) =>
          [s.scan_code, s.barcode, s.qr_code].some((v) => v === code),
        );

        if (localMatch) {
          addToCart(localMatch);
          setScanCode('');
          setAlertMessage(null);
          onStatus(`Servicio agregado por codigo: ${localMatch.name}.`);
          window.setTimeout(() => scannerInputRef.current?.focus(), 0);
          return;
        }

        const message = 'No se encontro servicio activo para este codigo.';
        setAlertMessage(message);
        onStatus(message);
        return;
      }

      addToCart(service);
      setScanCode('');
      setAlertMessage(null);
      onStatus(`Servicio agregado por codigo: ${service.name}.`);
      window.setTimeout(() => scannerInputRef.current?.focus(), 0);
    } catch (error) {
      const localMatch = services.find((s) =>
        [s.scan_code, s.barcode, s.qr_code].some((v) => v === code),
      );

      if (localMatch) {
        addToCart(localMatch);
        setScanCode('');
        setAlertMessage(null);
        onStatus(`Servicio agregado por codigo: ${localMatch.name}.`);
        window.setTimeout(() => scannerInputRef.current?.focus(), 0);
        return;
      }

      const message = userSafeErrorMessage(error, 'No se pudo buscar el codigo escaneado.');
      setAlertMessage(message);
      onStatus(message);
    }
  }

  function updateQuantity(index: number, quantity: string) {
    setCartItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, quantity } : item)),
    );
  }

  function removeItem(index: number) {
    setCartItems((current) => current.filter((_, idx) => idx !== index));
  }

  function handlePatientNameChange(value: string) {
    setPatientName(value);
    if (patientError && value.trim()) {
      setPatientError(undefined);
    }
  }

  function validateForm(): boolean {
    if (!loadedCashSession) {
      setAlertMessage('Abra caja antes de emitir y cobrar una factura.');
      onStatus('Abra caja antes de emitir y cobrar una factura.');
      return false;
    }

    if (patientName.trim() === '') {
      setPatientError('Ingrese el nombre del paciente para emitir la factura.');
      patientInputRef.current?.focus();
      return false;
    }

    if (cartItems.length === 0) {
      setAlertMessage('Seleccione al menos un servicio para emitir la factura.');
      onStatus('Seleccione al menos un servicio para emitir la factura.');
      return false;
    }

    return true;
  }

  function handleEmitClick() {
    setAlertMessage(null);
    if (!validateForm()) return;
    setShowConfirmation(true);
  }

  async function submitInvoice() {
    setSubmitting(true);
    setShowConfirmation(false);
    setAlertMessage(null);

    try {
      const invoice = await apiClient.createInvoice({
        patient_name: patientName,
        items: cartItems.map((item) => ({
          service_id: item.service.id,
          quantity: item.quantity,
          dialysis_prescription: item.dialysisPrescription,
        })),
      });

      setIssuedInvoice(invoice);
      setPaymentAmount(invoice.balance_due);
      setReceipt(null);
      setCartItems([]);
      setPatientName('');
      setShowSuccess(true);
      onStatus(`Factura emitida ${invoice.invoice_number}.`);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo emitir la factura.');
      setAlertMessage(message);
      onStatus(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCobrarClick() {
    if (!issuedInvoice || !loadedCashSession) {
      setAlertMessage('Debe abrir caja antes de cobrar.');
      return;
    }

    if (!canCreatePayments || !canViewReceipts) {
      setAlertMessage('Este usuario no tiene permisos completos para cobrar e imprimir recibos.');
      return;
    }

    setShowSuccess(false);
    setShowPayment(true);
  }

  async function submitPayment() {
    if (!issuedInvoice || !loadedCashSession) {
      setShowPayment(false);
      return;
    }

    const invoiceToPay = issuedInvoice;
    const sessionToUse = loadedCashSession;

    setPaying(true);
    setShowPayment(false);

    try {
      const result = await apiClient.registerPayment(invoiceToPay.id, {
        cash_session_id: sessionToUse.id,
        method: paymentMethod,
        amount: paymentAmount,
      });

      setIssuedInvoice(result.invoice);
      setPaymentAmount(result.invoice.balance_due);
      const nextReceipt = await apiClient.getReceipt(result.invoice.id, receiptWidth);
      setReceipt(nextReceipt);
      setReceiptWidth(nextReceipt.width);
      setShowReceipt(true);
      setAutoPrintReceiptKey(`${result.invoice.id}-${result.payment.id}-${nextReceipt.width}`);
      setAlertMessage(null);
      onStatus(`Pago registrado. Factura ${result.invoice.status}.`);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo registrar el pago.');
      setAlertMessage(message);
      onStatus(message);
    } finally {
      setPaying(false);
    }
  }

  async function loadReceipt(width: ReceiptData['width']) {
    setReceiptWidth(width);

    if (!issuedInvoice) return;

    try {
      setReceipt(await apiClient.getReceipt(issuedInvoice.id, width));
      setAutoPrintReceiptKey(null);
      setShowReceipt(true);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo.'));
    }
  }

  function handleNuevaFactura() {
    setIssuedInvoice(null);
    setReceipt(null);
    setCartItems([]);
    setPatientName('');
    setPatientError(undefined);
    setSearch('');
    setScanCode('');
    setSelectedCategoryId(undefined);
    window.setTimeout(() => patientInputRef.current?.focus(), 0);
  }

  return (
    <section id="nueva-factura" className="flex flex-col h-full gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-primary">Hospital Billing OS</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Nueva factura</h1>
          <p className="text-sm text-muted-foreground">POS hospitalario</p>
        </div>
        <div className="flex items-center gap-3">
          {loadedCashSession ? (
            <Badge variant="default" className="text-sm">
              Caja #{loadedCashSession.id} - Abierta
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm">
              Caja cerrada
            </Badge>
          )}
        </div>
      </header>

      {!loadedCashSession && (
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

      {alertMessage && (
        <Alert variant="destructive" title="Error" onClick={() => setAlertMessage(null)}>
          {alertMessage}
        </Alert>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_380px] lg:content-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <PatientStep
                patientName={patientName}
                onPatientNameChange={handlePatientNameChange}
                error={patientError}
              />
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base">Servicios facturables</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceSearch
                categories={categories}
                services={services}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
                search={search}
                onSearchChange={setSearch}
                scanCode={scanCode}
                onScanCodeChange={setScanCode}
                onAddService={addToCart}
                onAddByScanCode={addByScanCode}
                loading={loadingServices}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:h-fit">
          <CardContent className="pt-5">
            <InvoiceCart
              items={cartItems}
              preview={preview}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onConfirm={handleEmitClick}
              disabled={submitting || !loadedCashSession}
              submitting={submitting}
            />
          </CardContent>
        </Card>
      </div>

      <InvoiceConfirmation
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        patientName={patientName}
        items={cartItems}
        preview={preview}
        cashSessionId={loadedCashSession?.id}
        onConfirm={() => void submitInvoice()}
        submitting={submitting}
      />

      {issuedInvoice && (
        <PaymentModal
          open={showPayment}
          onOpenChange={setShowPayment}
          invoiceNumber={issuedInvoice.invoice_number}
          patientName={issuedInvoice.patient_name}
          total={issuedInvoice.total}
          balanceDue={issuedInvoice.balance_due}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          onPaymentMethodChange={setPaymentMethod}
          onPaymentAmountChange={setPaymentAmount}
          onConfirm={() => void submitPayment()}
          submitting={paying}
        />
      )}

      {issuedInvoice && (
        <InvoiceSuccess
          open={showSuccess}
          onOpenChange={setShowSuccess}
          invoiceNumber={issuedInvoice.invoice_number}
          patientName={issuedInvoice.patient_name}
          total={issuedInvoice.total}
          status={issuedInvoice.status}
          onCobrar={handleCobrarClick}
          onImprimir={() => void loadReceipt(receiptWidth)}
          onNuevaFactura={handleNuevaFactura}
        />
      )}

      <Dialog
        open={showReceipt && Boolean(receipt)}
        onOpenChange={setShowReceipt}
        size="lg"
        title="Preview térmico"
        description="Solo el ticket se imprime."
      >
        {receipt ? <ReceiptPreview receipt={receipt} onWidthChange={loadReceipt} /> : null}
      </Dialog>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl+N</kbd>{' '}
          Paciente
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
          Escanear
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Enter</kbd>{' '}
          Emitir
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>{' '}
          Limpiar
        </span>
      </div>
    </section>
  );
}

function calculatePreview(items: CartItem[]) {
  const subtotal = items.reduce((total, item) => {
    const unitPrice = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE
      ? 0
      : parseCents(item.service.price);
    const quantity = parseQuantityUnits(item.quantity);
    return total + Math.trunc((unitPrice * quantity + 50) / 100);
  }, 0);

  const tax = items.reduce((total, item) => {
    if (!item.service.taxable) return total;
    const unitPrice = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE
      ? 0
      : parseCents(item.service.price);
    const quantity = parseQuantityUnits(item.quantity);
    const lineSubtotal = Math.trunc((unitPrice * quantity + 50) / 100);
    return total + Math.trunc((lineSubtotal * 1500 + 5000) / 10000);
  }, 0);

  return {
    subtotal: formatCents(subtotal),
    tax: formatCents(tax),
    total: formatCents(subtotal + tax),
  };
}

function parseCents(value: string): number {
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function parseQuantityUnits(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 0;
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

function incrementQuantity(value: string): string {
  const units = parseQuantityUnits(value);
  return formatCents(units + 100);
}

function formatCents(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function printReceiptDocument(width: ReceiptData['width'], print: () => void) {
  const previousWidth = document.body.dataset.receiptWidth;
  const previousPrinting = document.body.dataset.printingReceipt;
  document.body.dataset.receiptWidth = width;
  document.body.dataset.printingReceipt = 'true';
  print();

  if (previousWidth) {
    document.body.dataset.receiptWidth = previousWidth;
  } else {
    delete document.body.dataset.receiptWidth;
  }

  if (previousPrinting) {
    document.body.dataset.printingReceipt = previousPrinting;
  } else {
    delete document.body.dataset.printingReceipt;
  }
}
