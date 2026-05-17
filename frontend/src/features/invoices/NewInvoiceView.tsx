import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    setSubmitting(true);
    setIssuedInvoice(null);
    setFormAlert(null);

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

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!issuedInvoice || !cashSession) {
      const message = 'Debe abrir caja antes de cobrar.';
      setFormAlert(message);
      onStatus(message);

      return;
    }

    setPaying(true);

    try {
      const result = await apiClient.registerPayment(issuedInvoice.id, {
        cash_session_id: cashSession.id,
        method: paymentMethod,
        amount: paymentAmount,
      });
      setIssuedInvoice(result.invoice);
      setPaymentAmount(result.invoice.balance_due);
      const nextReceipt = await apiClient.getReceipt(result.invoice.id, receiptWidth);
      setReceipt(nextReceipt);
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
      <form onSubmit={submitInvoice} className="invoice-panel pos-panel">
        <div className="section-heading">
          <div>
            <p className="app-kicker">POS hospitalario</p>
            <h2 id="invoice-title">Nueva factura</h2>
          </div>
          <button type="submit" disabled={submitting || selectedItems.length === 0}>
            {submitting ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>

        {formAlert ? (
          <div className="error-summary" role="alert" aria-live="assertive">
            {formAlert}
          </div>
        ) : null}

        <label>
          Nombre del paciente
          <input
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

        <label>
          Buscar por nombre, categoria o codigo
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Glucosa, Laboratorio, LAB-GLU-001"
          />
        </label>

        <div className="scanner-row">
          <label>
            Scanner USB o codigo manual
            <input
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
          <button type="button" onClick={() => void addByScanCode()}>
            Agregar codigo
          </button>
        </div>

        <div className="category-strip pos-category-strip" aria-label="Categorias de facturacion">
          <button
            type="button"
            className={selectedCategoryId === 'all' ? 'secondary-button selected-filter' : 'secondary-button'}
            onClick={() => setSelectedCategoryId('all')}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={
                selectedCategoryId === category.id ? 'secondary-button selected-filter' : 'secondary-button'
              }
              onClick={() => setSelectedCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="service-picker pos-service-grid" aria-label="Servicios facturables">
          {loadingServices ? (
            <p>Cargando servicios...</p>
          ) : selectedCategoryId === undefined && search.trim() === '' ? (
            <p className="muted">
              Seleccione una categoria, escriba una busqueda o escanee un codigo para empezar.
            </p>
          ) : filteredServices.length === 0 ? (
            <p>No hay servicios activos para mostrar.</p>
          ) : (
            visibleServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className="service-option"
                onClick={() => addService(service)}
              >
                <span>{service.name}</span>
                <strong>L. {service.price}</strong>
                <small>
                  {service.category?.name ?? 'Sin categoria'}
                  {service.scan_code ? ` - ${service.scan_code}` : ''}
                </small>
              </button>
            ))
          )}
          {hiddenServiceCount > 0 ? (
            <p className="muted">
              Hay {hiddenServiceCount} servicios mas. Use busqueda o una categoria mas especifica.
            </p>
          ) : null}
        </div>
      </form>

      <aside className="invoice-summary" aria-label="Resumen de factura">
        <h2>Servicios seleccionados</h2>
        {selectedItems.length === 0 ? (
          <p className="muted">Seleccione al menos un servicio.</p>
        ) : (
          <div className="selected-items">
            {selectedItems.map((item, index) => {
              const canApplyDialysisRule = item.service.special_rule_code === ERYTHROPOIETIN_RULE;

              return (
                <div className="selected-item" key={`${item.service.id}-${index}`}>
                  <div>
                    <strong>{item.service.name}</strong>
                    <span>L. {item.service.price}</span>
                  </div>
                  <label>
                    Cantidad
                    <input
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
                  <button type="button" className="secondary-button" onClick={() => removeItem(index)}>
                    Quitar
                  </button>
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
          <div>
            <dt>Total estimado</dt>
            <dd>L. {preview.total}</dd>
          </div>
        </dl>
        <p className="muted">El backend recalcula y guarda los valores finales al emitir.</p>

        {issuedInvoice ? (
          <div className="issued-box" role="status">
            <h2>Factura emitida</h2>
            <p>{issuedInvoice.invoice_number}</p>
            <strong>Total L. {issuedInvoice.total}</strong>
            <span>Estado: {issuedInvoice.status}</span>
            <span>Saldo L. {issuedInvoice.balance_due}</span>
          </div>
        ) : null}

        {issuedInvoice ? (
          <form className="payment-form" onSubmit={submitPayment}>
            <h2>Registrar pago</h2>
            {!cashSession ? (
              <p className="notice-inline" role="alert">
                Abra caja antes de cobrar.
              </p>
            ) : null}
            <label>
              Metodo de pago
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as Payment['method'])}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              Monto
              <input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
            </label>
            <button type="submit" disabled={!cashSession || paying || issuedInvoice.status === 'paid'}>
              {paying ? 'Cobrando...' : 'Cobrar'}
            </button>
          </form>
        ) : null}

        {receipt ? (
          <ReceiptPreview receipt={receipt} onWidthChange={loadReceipt} />
        ) : null}
      </aside>
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
