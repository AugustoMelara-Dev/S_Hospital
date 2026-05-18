import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyState, LoadingState } from '../../components/ui/states';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import {
  type Category,
  type CashSession,
  type Invoice,
  type Payment,
  type ReceiptData,
  type Service,
  apiClient,
} from '../../lib/api';
import { ReceiptPreview } from '../receipts/ReceiptPreview';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

type SelectedInvoiceItem = {
  service: Service;
  quantity: string;
  dialysisPrescription: boolean;
};

type NewInvoiceViewProps = {
  cashSession: CashSession | null;
  onStatus: (message: string) => void;
};

export function NewInvoiceView({ cashSession, onStatus }: NewInvoiceViewProps) {
  const [patientName, setPatientName] = useState('');
  const [search, setSearch] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all' | undefined>();
  const [selectedItems, setSelectedItems] = useState<SelectedInvoiceItem[]>([]);
  const [issuedInvoice, setIssuedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('80mm');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [confirmingInvoice, setConfirmingInvoice] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const patientInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadPointOfSaleData();
  }, []);

  const filteredServices = useMemo(() => {
    const needle = normalizeSearch(search);

    if (needle === '' && selectedCategoryId === undefined) {
      return [];
    }

    return services.filter((service) => {
      const matchesCategory =
        selectedCategoryId === undefined ||
        selectedCategoryId === 'all' ||
        service.category_id === selectedCategoryId;
      const haystack = [
        service.name,
        service.category?.name ?? '',
        service.scan_code ?? '',
        service.barcode ?? '',
        service.qr_code ?? '',
      ];
      const matchesSearch = needle === '' || fuzzyMatches(haystack, needle);

      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategoryId, services]);

  const visibleServices = filteredServices.slice(0, 36);
  const hiddenServiceCount = Math.max(filteredServices.length - visibleServices.length, 0);

  const preview = useMemo(() => calculatePreview(selectedItems), [selectedItems]);

  async function loadPointOfSaleData() {
    setLoadingServices(true);

    try {
      const [nextCategories, nextServices] = await Promise.all([
        apiClient.getCategories(true),
        apiClient.getServices({ active: true, perPage: 150 }),
      ]);
      setCategories(nextCategories);
      setServices(nextServices);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar servicios activos.');
    } finally {
      setLoadingServices(false);
    }
  }

  function addService(service: Service) {
    setFormAlert(null);
    setSelectedItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.service.id === service.id && !item.dialysisPrescription,
      );

      if (existingIndex === -1) {
        return [
          ...current,
          {
            service,
            quantity: '1.00',
            dialysisPrescription: false,
          },
        ];
      }

      return current.map((item, itemIndex) =>
        itemIndex === existingIndex
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
      setFormAlert(message);
      onStatus(message);

      return;
    }

    try {
      const [service] = await apiClient.getServices({ active: true, code, perPage: 1 });

      if (!service) {
        const message = 'No se encontro servicio activo para este codigo.';
        setFormAlert(message);
        onStatus(message);

        return;
      }

      addService(service);
      setScanCode('');
      setFormAlert(null);
      onStatus(`Servicio agregado por codigo: ${service.name}.`);
    } catch (error) {
      const localMatch = services.find((service) =>
        [service.scan_code, service.barcode, service.qr_code].some((value) => value === code),
      );

      if (localMatch) {
        addService(localMatch);
        setScanCode('');
        setFormAlert(null);
        onStatus(`Servicio agregado por codigo: ${localMatch.name}.`);

        return;
      }

      const message = error instanceof Error ? error.message : 'No se pudo buscar el codigo escaneado.';
      setFormAlert(message);
      onStatus(message);
    }
  }

  function updateItem(index: number, nextItem: SelectedInvoiceItem) {
    setSelectedItems((current) => current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function removeItem(index: number) {
    setSelectedItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function requestInvoiceConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cashSession) {
      const message = 'Abra caja antes de emitir y cobrar una factura.';
      setFormAlert(message);
      onStatus(message);

      return;
    }

    if (patientName.trim() === '') {
      const message = 'Falta el nombre del paciente.';
      setFormAlert(message);
      onStatus(message);
      patientInputRef.current?.focus();

      return;
    }

    if (selectedItems.length === 0) {
      const message = 'Seleccione al menos un servicio para emitir la factura.';
      setFormAlert(message);
      onStatus(message);

      return;
    }

    setFormAlert(null);
    setConfirmingInvoice(true);
  }

  async function submitInvoice() {
    setSubmitting(true);
    setIssuedInvoice(null);
    setFormAlert(null);
    setConfirmingInvoice(false);

    try {
      const invoice = await apiClient.createInvoice({
        patient_name: patientName,
        items: selectedItems.map((item) => ({
          service_id: item.service.id,
          quantity: item.quantity,
          dialysis_prescription: item.dialysisPrescription,
        })),
      });
      setIssuedInvoice(invoice);
      setPaymentAmount(invoice.balance_due);
      setReceipt(null);
      setSelectedItems([]);
      setPatientName('');
      onStatus(`Factura emitida ${invoice.invoice_number}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo emitir la factura.';
      setFormAlert(message);
      onStatus(message);
    } finally {
      setSubmitting(false);
    }
  }

  function requestPaymentConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!issuedInvoice || !cashSession) {
      const message = 'Debe abrir caja antes de cobrar.';
      setFormAlert(message);
      onStatus(message);

      return;
    }

    setFormAlert(null);
    setConfirmingPayment(true);
  }

  async function submitPayment() {
    if (!issuedInvoice || !cashSession) {
      setConfirmingPayment(false);
      return;
    }

    const invoiceToPay = issuedInvoice;
    const sessionToUse = cashSession;

    setPaying(true);
    setConfirmingPayment(false);

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
      setFormAlert(null);
      onStatus(`Pago registrado. Factura ${result.invoice.status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el pago.';
      setFormAlert(message);
      onStatus(message);
    } finally {
      setPaying(false);
    }
  }

  async function loadReceipt(width: ReceiptData['width']) {
    setReceiptWidth(width);

    if (!issuedInvoice) {
      return;
    }

    try {
      setReceipt(await apiClient.getReceipt(issuedInvoice.id, width));
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo generar el recibo.');
    }
  }

  return (
    <section id="nueva-factura" className="invoice-layout" aria-labelledby="invoice-title">
      <form onSubmit={requestInvoiceConfirmation} className="flex flex-col gap-5">
        <Card>
          <CardHeader className="md:flex-row md:items-end md:justify-between">
            <div>
              <CardDescription>POS hospitalario</CardDescription>
              <CardTitle id="invoice-title">Nueva factura</CardTitle>
            </div>
            <Button type="submit" disabled={submitting || selectedItems.length === 0}>
              {submitting ? 'Emitiendo...' : 'Emitir factura'}
            </Button>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {formAlert ? (
              <div className="error-summary" role="alert" aria-live="assertive">
                {formAlert}
              </div>
            ) : null}

            {!cashSession ? (
              <div className="rounded-lg border border-destructive bg-rose-50 p-4 text-sm text-destructive" role="alert">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <strong>No hay caja abierta. El flujo principal de facturacion esta bloqueado hasta abrir caja.</strong>
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/cashbox">Abrir caja</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Nombre del paciente
                <Input
                  ref={patientInputRef}
                  value={patientName}
                  onChange={(event) => {
                    setPatientName(event.target.value);
                    if (formAlert === 'Falta el nombre del paciente.') {
                      setFormAlert(null);
                    }
                  }}
                  placeholder="Maria Lopez"
                  aria-invalid={formAlert === 'Falta el nombre del paciente.' ? 'true' : 'false'}
                  aria-describedby={formAlert === 'Falta el nombre del paciente.' ? 'patient-name-error' : undefined}
                />
                {formAlert === 'Falta el nombre del paciente.' ? (
                  <span id="patient-name-error" className="field-error" role="alert">
                    Ingrese el nombre del paciente para emitir la factura.
                  </span>
                ) : null}
              </label>

              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-muted-foreground">Caja</span>
                  <Badge variant={cashSession ? 'default' : 'destructive'}>
                    {cashSession ? `Abierta #${cashSession.id}` : 'Cerrada'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Facturas pagadas quedan asociadas a caja, cajero, metodo y fecha.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Busqueda rapida</CardDescription>
            <CardTitle>Servicios facturables</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)_auto] lg:items-end">
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Buscar por nombre, categoria o codigo
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Glucosa, Laboratorio, LAB-GLU-001"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Scanner USB o codigo manual
                <Input
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addByScanCode();
                    }
                  }}
                  placeholder="Escanee y presione Enter"
                />
              </label>

              <Button type="button" variant="secondary" onClick={() => void addByScanCode()}>
                Agregar codigo
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/40 p-2" aria-label="Categorias de facturacion">
              <Button
                type="button"
                size="sm"
                variant={selectedCategoryId === 'all' ? 'default' : 'secondary'}
                onClick={() => setSelectedCategoryId('all')}
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  size="sm"
                  variant={selectedCategoryId === category.id ? 'default' : 'secondary'}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            <div className="pos-service-grid" aria-label="Servicios facturables">
              {loadingServices ? (
                <LoadingState label="Cargando servicios activos..." />
              ) : selectedCategoryId === undefined && search.trim() === '' ? (
                <EmptyState
                  title="Listo para buscar"
                  description="Seleccione una categoria, escriba una busqueda o escanee un codigo."
                />
              ) : filteredServices.length === 0 ? (
                <EmptyState title="Sin servicios activos" description="Ajuste la busqueda o cambie la categoria." />
              ) : (
                visibleServices.map((service) => (
                  <Button
                    key={service.id}
                    type="button"
                    variant="secondary"
                    className="service-option"
                    onClick={() => addService(service)}
                  >
                    <span>{service.name}</span>
                    <strong>L. {service.price}</strong>
                    <small>
                      {service.category?.name ?? 'Sin categoria'}
                      {service.scan_code ? ` - ${service.scan_code}` : ''}
                    </small>
                  </Button>
                ))
              )}
              {hiddenServiceCount > 0 ? (
                <p className="muted md:col-span-2 xl:col-span-3">
                  Hay {hiddenServiceCount} servicios mas. Use busqueda o una categoria mas especifica.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </form>

      <aside className="flex flex-col gap-5" aria-label="Resumen de factura">
        <Card>
          <CardHeader>
            <CardDescription>Factura en curso</CardDescription>
            <CardTitle>Carrito y totales</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {selectedItems.length === 0 ? (
              <EmptyState title="Sin servicios" description="Seleccione al menos un servicio para facturar." />
            ) : (
              <div className="selected-items">
                {selectedItems.map((item, index) => {
                  const canApplyDialysisRule = item.service.special_rule_code === ERYTHROPOIETIN_RULE;

                  return (
                    <div className="selected-item" key={`${item.service.id}-${index}`}>
                      <div>
                        <strong>{item.service.name}</strong>
                        <Badge variant="outline">L. {item.service.price}</Badge>
                      </div>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                        Cantidad
                        <Input
                          value={item.quantity}
                          onChange={(event) => updateItem(index, { ...item, quantity: event.target.value })}
                        />
                      </label>
                      {canApplyDialysisRule ? (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={item.dialysisPrescription}
                            onChange={(event) =>
                              updateItem(index, { ...item, dialysisPrescription: event.target.checked })
                            }
                          />
                          Receta de dialisis
                        </label>
                      ) : null}
                      <Button type="button" variant="secondary" size="sm" onClick={() => removeItem(index)}>
                        Quitar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <dl className="totals-list">
              <div>
                <dt>Subtotal estimado</dt>
                <dd>L. {preview.subtotal}</dd>
              </div>
              <div>
                <dt>ISV estimado</dt>
                <dd>L. {preview.tax}</dd>
              </div>
              <div className="border-t border-border pt-2 text-lg">
                <dt>Total estimado</dt>
                <dd>L. {preview.total}</dd>
              </div>
            </dl>
            <p className="muted">El backend recalcula y guarda los valores finales al emitir.</p>
          </CardContent>
        </Card>

        {issuedInvoice ? (
          <Card>
            <CardHeader>
              <CardDescription>Documento emitido</CardDescription>
              <CardTitle>{issuedInvoice.invoice_number}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="issued-box" role="status">
                <strong>Total L. {issuedInvoice.total}</strong>
                <span>Paciente: {issuedInvoice.patient_name}</span>
                <span>Estado: {issuedInvoice.status}</span>
                <span>Saldo L. {issuedInvoice.balance_due}</span>
              </div>

              <form className="payment-form" onSubmit={requestPaymentConfirmation}>
                <h2>Registrar pago</h2>
                {!cashSession ? (
                  <p className="notice-inline" role="alert">
                    Abra caja antes de cobrar. <Link to="/cashbox">Ir a caja</Link>
                  </p>
                ) : null}
                <label>
                  Metodo de pago
                  <Select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as Payment['method'])}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </Select>
                </label>
                <label>
                  Monto
                  <Input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                </label>
                <Button type="submit" disabled={!cashSession || paying || issuedInvoice.status === 'paid'}>
                  {paying ? 'Cobrando...' : 'Cobrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {receipt ? <ReceiptPreview receipt={receipt} onWidthChange={loadReceipt} /> : null}
      </aside>

      <ConfirmDialog
        confirmLabel="Confirmar emision"
        onCancel={() => setConfirmingInvoice(false)}
        onConfirm={() => void submitInvoice()}
        open={confirmingInvoice}
        title="Confirmar factura"
      >
        <div className="flex flex-col gap-2">
          <p>Paciente: <strong>{patientName || 'Sin paciente'}</strong></p>
          <p>Servicios: <strong>{selectedItems.length}</strong></p>
          <p>Total estimado: <strong>L. {preview.total}</strong></p>
          <p>Caja: <strong>#{cashSession?.id}</strong></p>
          <p>La factura se emitira con precios, impuestos y reglas recalculadas por el backend.</p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        confirmLabel="Confirmar cobro"
        onCancel={() => setConfirmingPayment(false)}
        onConfirm={() => void submitPayment()}
        open={confirmingPayment}
        title="Confirmar pago"
      >
        <div className="flex flex-col gap-2">
          <p>Factura: <strong>{issuedInvoice?.invoice_number}</strong></p>
          <p>Paciente: <strong>{issuedInvoice?.patient_name}</strong></p>
          <p>Metodo: <strong>{paymentMethod}</strong></p>
          <p>Monto: <strong>L. {paymentAmount}</strong></p>
          <p>Caja: <strong>{cashSession ? `#${cashSession.id}` : 'Sin caja abierta'}</strong></p>
        </div>
      </ConfirmDialog>
    </section>
  );
}

function calculatePreview(items: SelectedInvoiceItem[]) {
  const subtotal = items.reduce((total, item) => {
    const unitPrice = item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE
      ? 0
      : parseCents(item.service.price);
    const quantity = parseQuantityUnits(item.quantity);

    return total + Math.trunc((unitPrice * quantity + 50) / 100);
  }, 0);
  const tax = items.reduce((total, item) => {
    if (!item.service.taxable) {
      return total;
    }

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
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return 0;
  }

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

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function fuzzyMatches(values: string[], normalizedNeedle: string): boolean {
  const normalizedValues = values.map(normalizeSearch).filter(Boolean);
  const haystack = normalizedValues.join(' ');

  if (haystack.includes(normalizedNeedle)) {
    return true;
  }

  const haystackTokens = haystack.split(/\s+/).filter(Boolean);
  const needleTokens = normalizedNeedle.split(/\s+/).filter(Boolean);

  return needleTokens.every((needle) =>
    haystackTokens.some((token) => {
      if (token.includes(needle)) {
        return true;
      }

      if (needle.length < 4 || token.length < 4) {
        return false;
      }

      if (needle.includes(token)) {
        return true;
      }

      const maxDistance = needle.length > 7 ? 2 : 1;

      return levenshteinDistance(needle, token) <= maxDistance;
    }),
  );
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = leftIndex - 1;
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const insertion = previous[rightIndex] + 1;
      const deletion = previous[rightIndex - 1] + 1;
      const substitution = diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);

      diagonal = previous[rightIndex];
      previous[rightIndex] = Math.min(insertion, deletion, substitution);
    }
  }

  return previous[right.length];
}
