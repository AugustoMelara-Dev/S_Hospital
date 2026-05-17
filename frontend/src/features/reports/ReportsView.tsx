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
  type CategoryReport,
  type DailyReport,
  type IncomeReport,
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
  const [cashReportId, setCashReportId] = useState('');
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [categories, setCategories] = useState<CategoryReport | null>(null);
  const [serviceSales, setServiceSales] = useState<ServiceSalesReport | null>(null);
  const [cashSession, setCashSession] = useState<CashSessionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (canViewManagerial) {
      void loadDaily(dailyDate);
    }
  }, [canViewManagerial]);

  async function loadDaily(date: string) {
    setLoading(true);
    onStatus('Cargando reporte diario...');

    try {
      setDaily(await apiClient.getDailyReport(date));
      onStatus('Reporte diario cargado.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar el reporte diario.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDailySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDaily(dailyDate);
  }

  async function handleRangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    onStatus('Cargando reportes por rango...');

    try {
      const filters = {
        date_from: dateFrom,
        date_to: dateTo,
        cash_session_id: cashSessionId,
        user_id: userId,
      };
      const [incomeReport, categoryReport, serviceReport] = await Promise.all([
        apiClient.getIncomeReport(filters),
        apiClient.getCategoryReport({ date_from: dateFrom, date_to: dateTo }),
        apiClient.getServiceSalesReport({ date_from: dateFrom, date_to: dateTo }),
      ]);
      setIncome(incomeReport);
      setCategories(categoryReport);
      setServiceSales(serviceReport);
      onStatus('Reportes por rango cargados.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCashReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cashReportId.trim()) {
      onStatus('Ingrese el numero de caja.');
      return;
    }

    setLoading(true);
    onStatus('Cargando resumen de caja...');

    try {
      setCashSession(await apiClient.getCashSessionReport(cashReportId));
      onStatus('Resumen de caja cargado.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar la caja.');
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
            <button type="submit">Ver rango</button>
            <p className="muted">Rango maximo permitido: 31 dias.</p>
          </form>
        </>
      ) : (
        <p className="notice">Este usuario solo tiene acceso a reportes de caja permitidos.</p>
      )}

      {income ? (
        <div className="report-card" aria-label="Reporte por rango">
          <div className="report-card-heading">
            <h3>Ingresos por rango</h3>
            {canExport ? (
              <button type="button" className="secondary-button" onClick={() => exportReportsCsv(income, categories, serviceSales)}>
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

function exportReportsCsv(
  income: IncomeReport,
  categories: CategoryReport | null,
  serviceSales: ServiceSalesReport | null,
) {
  const rows = [
    ['seccion', 'nombre', 'categoria', 'cantidad', 'total'],
    ['ingresos', 'Total cobrado', '', '', income.total_collected],
    ...Object.entries(income.payments_by_method).map(([method, total]) => [
      'metodo_pago',
      method,
      '',
      '',
      total,
    ]),
    ...(categories?.categories ?? []).map((category) => [
      'categoria',
      category.category,
      category.category,
      category.quantity,
      category.total,
    ]),
    ...(serviceSales?.services ?? []).map((service) => [
      'servicio',
      service.service,
      service.category,
      service.quantity,
      service.total,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `reporte-hospital-${income.date_from}-a-${income.date_to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function serviceSalesChartData(serviceSales: ServiceSalesReport) {
  return serviceSales.services.slice(0, 8).map((service) => ({
    service: service.service.length > 18 ? `${service.service.slice(0, 18)}...` : service.service,
    total: Number.parseFloat(service.total),
  }));
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
