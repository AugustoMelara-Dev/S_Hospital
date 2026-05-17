import { type FormEvent, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type CashSessionReport,
  type Category,
  type CategoryReport,
  type DailyReport,
  type IncomeReport,
  type OperationsReport,
  type ServiceSalesReport,
  apiClient,
} from '../../lib/api';

type ReportsViewProps = {
  canExport: boolean;
  canViewCashSessionReport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

const today = localDateString(new Date());

export function ReportsView({
  canExport,
  canViewCashSessionReport,
  canViewManagerial,
  onStatus,
}: ReportsViewProps) {
  const [dailyDate, setDailyDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [cashSessionId, setCashSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [cashReportId, setCashReportId] = useState('');
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [categories, setCategories] = useState<CategoryReport | null>(null);
  const [serviceSales, setServiceSales] = useState<ServiceSalesReport | null>(null);
  const [operations, setOperations] = useState<OperationsReport | null>(null);
  const [cashSession, setCashSession] = useState<CashSessionReport | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [dailyError, setDailyError] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [cashError, setCashError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (canViewManagerial) {
      void loadDaily(dailyDate);
      void loadCategories();
    }
  }, [canViewManagerial]);

  async function loadDaily(date: string) {
    setLoading(true);
    setDailyError('');
    onStatus('Cargando reporte diario...');

    try {
      setDaily(await apiClient.getDailyReport(date));
      onStatus('Reporte diario cargado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el reporte diario.';
      setDailyError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDailySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDaily(dailyDate);
  }

  async function loadCategories() {
    try {
      const nextCategories = await apiClient.getCategories();
      setCategoryOptions(Array.isArray(nextCategories) ? nextCategories : []);
    } catch {
      setCategoryOptions([]);
    }
  }

  async function handleRangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setRangeError('');
    onStatus('Cargando reportes por rango...');

    try {
      const filters = {
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
        user_id: userId,
        category_id: categoryId,
        method: method as '' | 'cash' | 'transfer' | 'card' | 'other',
        status: status as '' | 'issued' | 'partial' | 'paid' | 'void',
      };
      const [incomeReport, categoryReport, serviceReport, operationsReport] = await Promise.all([
        apiClient.getIncomeReport(filters),
        apiClient.getCategoryReport(filters),
        apiClient.getServiceSalesReport(filters),
        apiClient.getOperationsReport(filters),
      ]);
      setIncome(incomeReport);
      setCategories(categoryReport);
      setServiceSales(serviceReport);
      setOperations(operationsReport);
      onStatus('Reportes por rango cargados.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los reportes.';
      setRangeError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCashReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cashReportId.trim()) {
      setCashError('Ingrese el numero de caja.');
      onStatus('Ingrese el numero de caja.');
      return;
    }

    setLoading(true);
    setCashError('');
    onStatus('Cargando resumen de caja...');

    try {
      setCashSession(await apiClient.getCashSessionReport(cashReportId));
      onStatus('Resumen de caja cargado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la caja.';
      setCashError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="reportes" className="reports-layout" aria-labelledby="reports-title">
      <div className="section-heading">
        <div>
          <p className="app-kicker">Gerencia hospitalaria</p>
          <h2 id="reports-title">Reportes</h2>
        </div>
        <span className="muted">{loading ? 'Consultando...' : 'Agregaciones del backend'}</span>
      </div>

      {canViewManagerial ? (
        <>
          <form className="report-filters" onSubmit={handleDailySubmit}>
            <label>
              Fecha diaria
              <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
            </label>
            <button type="submit">Ver diario</button>
          </form>
          {dailyError ? <p className="notice error-notice">{dailyError}</p> : null}

          {daily ? (
            <div className="report-card" aria-label="Resumen diario">
              <h3>Reporte diario</h3>
              <div className="metric-grid">
                <Metric label="Total facturado" value={`L. ${daily.total_billed}`} />
                <Metric label="Total cobrado" value={`L. ${daily.total_collected}`} />
                <Metric label="Facturas" value={String(daily.invoice_count)} />
                <Metric label="Pagos" value={String(daily.payment_count)} />
              </div>
              <MethodTable totals={daily.payments_by_method} />
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(daily.invoices_by_status).map(([status, value]) => (
                    <tr key={status}>
                      <td>{status}</td>
                      <td>{value.count}</td>
                      <td>L. {value.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice">Sin datos diarios cargados.</p>
          )}

          <form className="report-filters range-filters" onSubmit={handleRangeSubmit}>
            <label>
              Desde
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label>
              Caja
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={cashSessionId}
                onChange={(event) => setCashSessionId(event.target.value)}
              />
            </label>
            <label>
              Cajero
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              />
            </label>
            <label>
              Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Todas</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metodo de pago
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              Estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Financieros no anulados</option>
                <option value="issued">Emitida</option>
                <option value="partial">Parcial</option>
                <option value="paid">Pagada</option>
                <option value="void">Anulada</option>
              </select>
            </label>
            <button type="submit">Ver rango</button>
            <p className="muted">
              Rango maximo permitido: 31 dias. Categoria prorratea cobros por items; backups solo respetan fecha y usuario.
            </p>
          </form>
          {rangeError ? <p className="notice error-notice">{rangeError}</p> : null}
        </>
      ) : (
        <p className="notice">Este usuario solo tiene acceso a reportes de caja permitidos.</p>
      )}

      {income ? (
        <div className="report-card" aria-label="Reporte por rango">
          <div className="report-card-heading">
            <h3>Ingresos por rango</h3>
            {canExport ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  window.location.assign(apiClient.reportExportUrl({
                    date_from: income.date_from,
                    date_to: income.date_to,
                    cash_session_id: cashSessionId,
                    user_id: userId,
                    category_id: categoryId,
                    method: method as '' | 'cash' | 'transfer' | 'card' | 'other',
                    status: status as '' | 'issued' | 'partial' | 'paid' | 'void',
                  }))
                }
              >
                Exportar CSV
              </button>
            ) : null}
          </div>
          <div className="metric-grid">
            <Metric label="Total cobrado" value={`L. ${income.total_collected}`} />
            <Metric label="Pagos" value={String(income.payment_count)} />
            <Metric label="Facturas pagadas/parciales" value={String(income.invoice_count)} />
          </div>
          <MethodTable totals={income.payments_by_method} />
        </div>
      ) : null}

      {categories ? (
        <div className="report-card" aria-label="Reporte por categorias">
          <h3>Categorias</h3>
          {categories.categories.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Items</th>
                    <th>Subtotal</th>
                    <th>ISV</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.categories.map((category) => (
                    <tr key={category.category}>
                      <td>{category.category}</td>
                      <td>{category.item_count}</td>
                      <td>L. {category.subtotal}</td>
                      <td>L. {category.tax_amount}</td>
                      <td>L. {category.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Sin categorias en el rango seleccionado.</p>
          )}
        </div>
      ) : null}

      {serviceSales ? (
        <div className="report-card" aria-label="Top servicios">
          <h3>Servicios mas vendidos</h3>
          {serviceSales.services.length > 0 ? (
            <>
              <div className="report-chart" aria-label="Grafico de servicios mas vendidos">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={serviceSalesChartData(serviceSales)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="service" tickLine={false} interval={0} height={70} angle={-20} textAnchor="end" />
                    <YAxis tickLine={false} width={64} />
                    <Tooltip formatter={(value) => [`L. ${value}`, 'Total']} />
                    <Bar dataKey="total" fill="#0f766e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="service-sales-list">
                {serviceSales.services.map((service) => (
                  <div className="service-sales-row" key={`${service.service}-${service.category}`}>
                    <div>
                      <strong>{service.service}</strong>
                      <span>{service.category} - {service.quantity} unidades - L. {service.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Sin servicios facturados en el rango seleccionado.</p>
          )}
        </div>
      ) : null}

      {operations ? (
        <div className="report-card" aria-label="Auditoria operativa">
          <h3>Auditoria operativa</h3>
          <div className="metric-grid">
            <Metric label="Anulaciones" value={String(operations.summary.void_count)} />
            <Metric label="Reimpresiones" value={String(operations.summary.reprint_count)} />
            <Metric label="Backups" value={String(operations.summary.backup_count)} />
            <Metric label="Backups fallidos" value={String(operations.summary.failed_backup_count)} />
            <Metric label="Cajeros con ingreso" value={String(operations.summary.cashier_count)} />
          </div>
          {operations.cashiers.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cajero</th>
                    <th>Cajas</th>
                    <th>Facturas</th>
                    <th>Pagos</th>
                    <th>Total cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.cashiers.map((cashier) => (
                    <tr key={cashier.user_id}>
                      <td>{cashier.name}</td>
                      <td>{cashier.cash_session_count}</td>
                      <td>{cashier.invoice_count}</td>
                      <td>{cashier.payment_count}</td>
                      <td>L. {cashier.total_collected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {operations.voids.map((item) => (
                  <tr key={`void-${item.invoice_id}`}>
                    <td>Anulacion</td>
                    <td>{item.invoice_number}</td>
                    <td>{item.reason ?? 'Sin motivo'} - L. {item.total}</td>
                    <td>{item.user ?? 'Sin usuario'}</td>
                    <td>{formatDateTime(item.voided_at)}</td>
                  </tr>
                ))}
                {operations.reprints.map((item, index) => (
                  <tr key={`reprint-${item.invoice_id ?? index}-${item.created_at ?? index}`}>
                    <td>Reimpresion</td>
                    <td>{item.invoice_number ?? 'Sin factura'}</td>
                    <td>{item.width ?? 'Sin ancho'} - {item.reason ?? 'Sin motivo'}</td>
                    <td>{item.user ?? 'Sin usuario'}</td>
                    <td>{formatDateTime(item.created_at)}</td>
                  </tr>
                ))}
                {operations.backups.map((item) => (
                  <tr key={`backup-${item.id}`}>
                    <td>Backup</td>
                    <td>{item.filename}</td>
                    <td>{item.status} - {formatBytes(item.size_bytes)}</td>
                    <td>{item.creator ?? 'Sistema'}</td>
                    <td>{formatDateTime(item.completed_at ?? item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {operations.voids.length + operations.reprints.length + operations.backups.length === 0 ? (
            <p className="muted">Sin eventos operativos en el rango seleccionado.</p>
          ) : null}
        </div>
      ) : null}

      {canViewCashSessionReport ? (
        <form className="report-filters" onSubmit={handleCashReportSubmit}>
          <label>
            Numero de caja
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={cashReportId}
              onChange={(event) => setCashReportId(event.target.value)}
            />
          </label>
          <button type="submit">Ver caja</button>
        </form>
      ) : null}
      {cashError ? <p className="notice error-notice">{cashError}</p> : null}

      {cashSession ? (
        <div className="report-card" aria-label="Resumen de caja">
          <h3>Resumen de caja</h3>
          <div className="metric-grid">
            <Metric label="Cajero" value={cashSession.cash_session.user?.name ?? 'Sin cajero'} />
            <Metric label="Apertura" value={`L. ${cashSession.cash_session.opening_amount}`} />
            <Metric label="Esperado" value={`L. ${cashSession.cash_session.expected_amount ?? '0.00'}`} />
            <Metric label="Contado" value={`L. ${cashSession.cash_session.closing_amount ?? '0.00'}`} />
            <Metric label="Diferencia" value={`L. ${cashSession.cash_session.difference_amount ?? '0.00'}`} />
          </div>
          <MethodTable totals={cashSession.totals_by_method} />
          <p className="muted">
            Pagos: {cashSession.payments.length} · Movimientos: {cashSession.movements.length}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MethodTable({ totals }: { totals: DailyReport['payments_by_method'] }) {
  return (
    <table className="compact-table" aria-label="Totales por metodo de pago">
      <thead>
        <tr>
          <th>Efectivo</th>
          <th>Transferencia</th>
          <th>Tarjeta</th>
          <th>Otro</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>L. {totals.cash}</td>
          <td>L. {totals.transfer}</td>
          <td>L. {totals.card}</td>
          <td>L. {totals.other}</td>
        </tr>
      </tbody>
    </table>
  );
}

function serviceSalesChartData(serviceSales: ServiceSalesReport) {
  return serviceSales.services.slice(0, 8).map((service) => ({
    service: service.service.length > 18 ? `${service.service.slice(0, 18)}...` : service.service,
    total: Number.parseFloat(service.total),
  }));
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(size: number | null): string {
  if (size === null) {
    return 'No disponible';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
