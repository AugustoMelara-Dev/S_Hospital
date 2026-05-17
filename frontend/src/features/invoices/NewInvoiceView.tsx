import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
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
  const [services, setServices] = useState<Service[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedInvoiceItem[]>([]);
  const [issuedInvoice, setIssuedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('80mm');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    void loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (needle === '') {
      return services;
    }

    return services.filter((service) =>
      `${service.name} ${service.category?.name ?? ''}`.toLowerCase().includes(needle),
    );
  }, [search, services]);

  const preview = useMemo(() => calculatePreview(selectedItems), [selectedItems]);

  async function loadServices() {
    setLoadingServices(true);

    try {
      const nextServices = await apiClient.getServices({ active: true, perPage: 150 });
      setServices(nextServices);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar servicios activos.');
    } finally {
      setLoadingServices(false);
    }
  }

  function addService(service: Service) {
    setSelectedItems((current) => [
      ...current,
      {
        service,
        quantity: '1.00',
        dialysisPrescription: false,
      },
    ]);
    setIssuedInvoice(null);
  }

  function updateItem(index: number, nextItem: SelectedInvoiceItem) {
    setSelectedItems((current) => current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function removeItem(index: number) {
    setSelectedItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setIssuedInvoice(null);

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
      onStatus(error instanceof Error ? error.message : 'No se pudo emitir la factura.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!issuedInvoice || !cashSession) {
      onStatus('Debe abrir caja antes de cobrar.');

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
      onStatus(`Pago registrado. Factura ${result.invoice.status}.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
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
      <form onSubmit={submitInvoice} className="invoice-panel">
        <div className="section-heading">
          <div>
            <p className="app-kicker">Fase 4</p>
            <h2 id="invoice-title">Nueva factura</h2>
          </div>
          <button type="submit" disabled={submitting || selectedItems.length === 0}>
            {submitting ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>

        <label>
          Nombre del paciente
          <input
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            placeholder="Maria Lopez"
          />
        </label>

        <label>
          Buscar servicios activos
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Glucosa, hemograma, eritropoyetina"
          />
        </label>

        <div className="service-picker" aria-label="Servicios activos">
          {loadingServices ? (
            <p>Cargando servicios...</p>
          ) : filteredServices.length === 0 ? (
            <p>No hay servicios activos para mostrar.</p>
          ) : (
            filteredServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className="service-option"
                onClick={() => addService(service)}
              >
                <span>{service.name}</span>
                <strong>L. {service.price}</strong>
                <small>{service.category?.name ?? 'Sin categoria'}</small>
              </button>
            ))
          )}
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

function formatCents(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
