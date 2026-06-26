import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InfoPanel, OperationalBanner } from '@/components/shared';
import {
  type ExecutiveReport,
  type ExecutiveReportFilters,
  type Area,
  type AreaIncomeReport,
  type CashSession,
  type CashSessionReport,
  type Category,
  type CategoryReport,
  type DailyReport,
  type IncomeReport,
  type MonthlyReport,
  type OperationsReport,
  type ReportFilters,
  type ServiceSalesReport,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { useExecutiveReport } from '@/hooks/useExecutiveReport';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { TrendChart } from './components/TrendChart';
import { PaymentMethodPanel } from './components/PaymentMethodPanel';
import { ServiceRanking } from './components/ServiceRanking';
import { CashReconciliationPanel } from './components/CashReconciliationPanel';
import { CashierTable } from './components/CashierTable';
import { VoidsReversalsPanel } from './components/VoidsReversalsPanel';
import { PendingAgingPanel } from './components/PendingAgingPanel';
import { AuditSummaryPanel } from './components/AuditSummaryPanel';
import { MetricsGlossary } from './components/MetricsGlossary';
import {
  ReportFiltersPanel,
  computePresetRange,
  type PresetKey,
} from './components/ReportFiltersPanel';
import { DailyReportTab } from './components/DailyReportTab';
import { MonthlyReportTab } from './components/MonthlyReportTab';
import { IncomeReportTab } from './components/IncomeReportTab';
import { ServiceSalesTab } from './components/ServiceSalesTab';
import { AuditoriaTab } from './components/AuditoriaTab';
import { CashSessionReportTab } from './components/CashSessionReportTab';
import { useCashSession } from '@/hooks/useCashSession';
import { notify } from '@/components/ui/toaster';
import { downloadBlob, openBlobInNewTab } from '@/lib/download';
import { queryClient } from '@/lib/query-client';
import { localDateString } from './ReportsView.helpers';
import { formatLempirasUIFromCents, parseCents } from '@/lib/moneyCents';

type ReportsViewProps = {
  canExport: boolean;
  canViewCashSessionReport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

const today = localDateString(new Date());
const currentMonth = today.slice(0, 7);
const MAX_REPORT_RANGE_DAYS = 31;

export function ReportsView(props: ReportsViewProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReportsViewContent {...props} />
    </QueryClientProvider>
  );
}

function ReportsViewContent({
  canExport,
  canViewCashSessionReport,
  canViewManagerial,
  onStatus,
}: ReportsViewProps) {
  const initialPreset = canViewManagerial ? 'thisMonth' : 'today';
  const [preset, setPreset] = useState<PresetKey>(initialPreset);
  const [filters, setFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange(initialPreset);
    return {
      date_from: initialRange.from,
      date_to: initialRange.to,
    };
  });
  const [appliedFilters, setAppliedFilters] = useState<ExecutiveReportFilters>(() => {
    const initialRange = computePresetRange(initialPreset);
    return {
      date_from: initialRange.from,
      date_to: initialRange.to,
    };
  });

  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(today);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [categoryId, setCategoryId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [cashSessionId, setCashSessionId] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [method, setMethod] = useState<NonNullable<ReportFilters['method']>>('');
  const [status, setStatus] = useState<NonNullable<ReportFilters['status']>>('');
  const [cashReportId, setCashReportId] = useState('');
  const [dailyError, setDailyError] = useState('');
  const [monthlyError, setMonthlyError] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [cashError, setCashError] = useState('');
  const [exportingReport, setExportingReport] = useState<string | null>(null);
  const [classicLoading, setClassicLoading] = useState(false);
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [categories, setCategories] = useState<CategoryReport | null>(null);
  const [areas, setAreas] = useState<AreaIncomeReport | null>(null);
  const [serviceSales, setServiceSales] = useState<ServiceSalesReport | null>(null);
  const [operations, setOperations] = useState<OperationsReport | null>(null);
  const [cashSessionReport, setCashSessionReport] = useState<CashSessionReport | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [areaOptions, setAreaOptions] = useState<Area[]>([]);
  const [cashSessionOptions, setCashSessionOptions] = useState<CashSession[]>([]);
  const exportingReportRef = useRef(false);
  const executiveRangeError = validateReportDateRange(filters.date_from, filters.date_to);

  const appliedRangeError = validateReportDateRange(appliedFilters.date_from, appliedFilters.date_to);
  const { data: report, isFetching, isError, refetch, error: queryError } = useExecutiveReport(appliedFilters, canViewManagerial && appliedRangeError === null);
  const { data: cashSession } = useCashSession();
  const exportInProgress = exportingReport !== null;

  useEffect(() => {
    if (isError && queryError) {
      setError(userSafeErrorMessage(queryError, 'No se pudo cargar el reporte ejecutivo.'));
      return;
    }

    if (!isError) {
      setError(null);
    }
  }, [isError, queryError]);

  useEffect(() => {
    if (!canViewManagerial) return;

    void loadDaily(dailyDate);
    void loadCategories();
    void loadAreas();
    void loadCashSessionOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewManagerial]);

  function handleRefresh() {
    if (executiveRangeError) {
      onStatus(executiveRangeError);
      return;
    }

    if (sameExecutiveFilters(filters, appliedFilters)) {
      void refetch();
      return;
    }

    setAppliedFilters(filters);
  }

  function handleFiltersChange(next: ExecutiveReportFilters) {
    setFilters(next);
  }

  function handlePresetChange(next: PresetKey) {
    setPreset(next);
    if (next !== 'custom') {
      const range = computePresetRange(next);
      const nextFilters = { ...filters, date_from: range.from, date_to: range.to };
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
    }
  }

  function handleExportPdf() {
    if (!canExport) {
      notify.warning('Exportacion PDF requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify.warning(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    onStatus('Preparando PDF ejecutivo...');
    void runReportExport('executive-pdf', downloadExecutivePdf);
  }

  function handleExportExcel() {
    if (!canExport) {
      notify.warning('Exportacion Excel requiere permiso de exportacion de reportes.');
      return;
    }
    if (executiveRangeError) {
      notify.warning(executiveRangeError);
      onStatus(executiveRangeError);
      return;
    }
    onStatus('Descargando Excel ejecutivo...');
    void runReportExport('executive-excel', downloadExcel);
  }

  async function runReportExport(kind: string, task: () => Promise<void>) {
    if (exportingReportRef.current) {
      onStatus('Espere a que termine la exportacion actual.');
      return;
    }

    exportingReportRef.current = true;
    setExportingReport(kind);

    try {
      await task();
    } finally {
      exportingReportRef.current = false;
      setExportingReport(null);
    }
  }

  async function loadDaily(date: string) {
    setClassicLoading(true);
    setDailyError('');
    onStatus('Cargando reporte diario...');

    try {
      setDaily(await apiClient.getDailyReport(date));
      onStatus('Reporte diario cargado.');
    } catch (loadError) {
      const message = userSafeErrorMessage(loadError, 'No se pudo cargar el reporte diario.');
      setDailyError(message);
      onStatus(message);
    } finally {
      setClassicLoading(false);
    }
  }

  async function loadMonthly(month: string) {
    setClassicLoading(true);
    setMonthlyError('');
    onStatus('Cargando reporte mensual...');

    try {
      setMonthly(await apiClient.getMonthlyReport(month));
      onStatus('Reporte mensual cargado.');
    } catch (loadError) {
      const message = userSafeErrorMessage(loadError, 'No se pudo cargar el reporte mensual.');
      setMonthlyError(message);
      onStatus(message);
    } finally {
      setClassicLoading(false);
    }
  }

  async function loadCategories() {
    try {
      setCategoryOptions(await apiClient.getCategories());
    } catch {
      setCategoryOptions([]);
    }
  }

  async function loadAreas() {
    try {
      setAreaOptions(await apiClient.getAreas(true));
    } catch {
      setAreaOptions([]);
    }
  }

  async function loadCashSessionOptions() {
    try {
      const response = await apiClient.getCashSessions({ perPage: 50 });
      setCashSessionOptions(Array.isArray(response.data) ? response.data : []);
    } catch {
      setCashSessionOptions([]);
    }
  }

  async function loadRangeReports() {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > MAX_REPORT_RANGE_DAYS) {
      const message = 'El rango maximo permitido para reportes es de 31 dias.';
      setRangeError(message);
      onStatus(message);
      return;
    }

    if (diffDays < 1) {
      const message = 'La fecha de inicio debe ser anterior o igual a la fecha de fin.';
      setRangeError(message);
      onStatus(message);
      return;
    }

    setClassicLoading(true);
    setRangeError('');
    onStatus('Cargando reportes por rango...');

    try {
      const rangeFilters = reportFilters();
      const [incomeReport, categoryReport, areaReport, serviceReport, operationsReport] = await Promise.all([
        apiClient.getIncomeReport(rangeFilters),
        apiClient.getCategoryReport(rangeFilters),
        apiClient.getAreaIncomeReport(rangeFilters),
        apiClient.getServiceSalesReport(rangeFilters),
        apiClient.getOperationsReport(rangeFilters),
      ]);
      setIncome(incomeReport);
      setCategories(categoryReport);
      setAreas(areaReport);
      setServiceSales(serviceReport);
      setOperations(operationsReport);
      onStatus('Reportes por rango cargados.');
    } catch (loadError) {
      const message = userSafeErrorMessage(loadError, 'No se pudieron cargar los reportes.');
      setRangeError(message);
      onStatus(message);
    } finally {
      setClassicLoading(false);
    }
  }

  async function loadCashReport() {
    if (!cashReportId.trim()) {
      setCashError('Ingrese el numero de caja.');
      onStatus('Ingrese el numero de caja.');
      return;
    }

    setClassicLoading(true);
    setCashError('');
    onStatus('Cargando resumen de caja...');

    try {
      setCashSessionReport(await apiClient.getCashSessionReport(cashReportId));
      onStatus('Resumen de caja cargado.');
    } catch (loadError) {
      const message = userSafeErrorMessage(loadError, 'No se pudo cargar la caja.');
      setCashError(message);
      onStatus(message);
    } finally {
      setClassicLoading(false);
    }
  }

  function reportFilters(): ReportFilters {
    return {
      date_from: dateFrom,
      date_to: dateTo,
      category_id: categoryId || null,
      area_id: areaId || null,
      user_id: cashierId || null,
      cash_session_id: cashSessionId || null,
      method: method || null,
      status: status || null,
    };
  }

  async function downloadBackendExport(rangeFilters: ReportFilters) {
    if (!canExport) {
      onStatus('Exportacion Excel requiere permiso de exportacion de reportes.');
      return;
    }

    onStatus('Preparando exportacion Excel...');

    try {
      const blob = await apiClient.downloadReportExport(rangeFilters);
      downloadBlob(blob, `reporte-hospital-${rangeFilters.date_from ?? today}-a-${rangeFilters.date_to ?? today}.xlsx`);
      onStatus('Exportacion Excel descargada.');
    } catch (exportError) {
      const message = userSafeErrorMessage(exportError, 'No se pudo exportar el reporte.');
      onStatus(message);
    }
  }

  async function downloadBackendPdf(rangeFilters: ReportFilters & { date?: string }) {
    if (!canExport) {
      onStatus('Exportacion PDF requiere permiso de exportacion de reportes.');
      return;
    }

    onStatus('Preparando exportacion PDF...');

    try {
      const blob = await apiClient.downloadReportPdf(rangeFilters);
      const filename = rangeFilters.date
        ? `cierre_diario_${rangeFilters.date}.pdf`
        : `cierre_periodo_${rangeFilters.date_from}_a_${rangeFilters.date_to}.pdf`;
      downloadBlob(blob, filename);
      onStatus('Exportacion PDF descargada.');
    } catch (exportError) {
      const message = userSafeErrorMessage(exportError, 'No se pudo exportar el reporte PDF.');
      onStatus(message);
    }
  }

  function handleDailySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDaily(dailyDate);
  }

  function handleMonthlySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadMonthly(monthlyMonth);
  }

  function handleCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCashReport();
  }

  async function downloadExecutivePdf() {
    try {
      const blob = await apiClient.downloadExecutivePdf(filters);
      openBlobInNewTab(blob, `reporte-ejecutivo-${filters.date_from}-a-${filters.date_to}.pdf`);
      notify.success('PDF ejecutivo generado.');
      onStatus('PDF ejecutivo generado.');
    } catch (exportError) {
      const message = userSafeErrorMessage(exportError, 'No se pudo generar el PDF ejecutivo.');
      notify.error(message);
      onStatus(message);
    }
  }

  async function downloadExcel() {
    try {
      const blob = await apiClient.downloadExecutiveExcel(filters);
      downloadBlob(blob, `reporte-ejecutivo-${filters.date_from}-a-${filters.date_to}.xlsx`);
      notify.success('Excel ejecutivo descargado.');
      onStatus('Excel ejecutivo descargado.');
    } catch (exportError) {
      const message = userSafeErrorMessage(exportError, 'No se pudo descargar el Excel.');
      notify.error(message);
      onStatus(message);
    }
  }

  return (
    <section id="reportes" aria-label="Reportes" className="flex flex-col gap-5">
      <OperationalBanner
        meta="Reportes y analitica"
        title="Reportes"
        description="Facturación, cobros, caja y auditoría en una vista clara, ejecutiva y auditada para contabilidad, administración y supervisión."
        status={
          <div className="flex flex-wrap items-center gap-2">
            {canViewManagerial ? <Badge variant="secondary">Ejecutivo</Badge> : null}
            {canViewCashSessionReport ? <Badge variant="secondary">Caja</Badge> : null}
            {cashSession?.status === 'open' ? <Badge variant="success">Caja abierta #{cashSession.id}</Badge> : null}
          </div>
        }
      />

      {canViewManagerial ? (
        <ReportFiltersPanel
          filters={filters}
          preset={preset}
          onPresetChange={handlePresetChange}
          onChange={handleFiltersChange}
          onRefresh={handleRefresh}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          canExport={canExport}
          loading={isFetching}
          exporting={exportInProgress}
          rangeError={executiveRangeError}
        />
      ) : null}

      {canViewManagerial && executiveRangeError ? (
        <Alert variant="warning" title="Rango ejecutivo no valido">
          {executiveRangeError}
        </Alert>
      ) : null}

      {canViewManagerial && error ? (
        <ErrorState
          title="No se pudo cargar el reporte ejecutivo"
          description={error}
          action={
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              Reintentar
            </button>
          }
        />
      ) : null}

      {canViewManagerial && isFetching && !report ? (
        <LoadingState label="Cargando reporte ejecutivo..." />
      ) : null}

      <Tabs defaultValue={canViewManagerial ? 'resumen' : 'caja'}>
        <div className="rounded-panel border border-operational-border bg-operational-surface p-2 shadow-operational">
          <div className="overflow-x-auto pb-1">
          <TabsList aria-label="Secciones de reportes" className="h-auto min-w-max flex-wrap gap-1 bg-transparent py-1">
            {canViewManagerial ? (
              <>
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="diario">Diario</TabsTrigger>
                <TabsTrigger value="mensual">Mensual</TabsTrigger>
                <TabsTrigger value="rango">Por rango</TabsTrigger>
                <TabsTrigger value="tendencia">Tendencia</TabsTrigger>
                <TabsTrigger value="metodos">Métodos</TabsTrigger>
                <TabsTrigger value="servicios">Servicios</TabsTrigger>
                <TabsTrigger value="cajeros">Cajeros</TabsTrigger>
                <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
                <TabsTrigger value="anulaciones">Anulaciones</TabsTrigger>
                <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
                <TabsTrigger value="exportaciones">Exportaciones</TabsTrigger>
              </>
            ) : null}
            {canViewCashSessionReport ? <TabsTrigger value="caja">Caja</TabsTrigger> : null}
          </TabsList>
          </div>
        </div>

          <TabsContent value="resumen">
            <div className="flex flex-col gap-5">
              {report ? (
                <>
                <ExecutiveSummary report={report} />
                <PaymentMethodPanel report={report} />
                <div className="flex justify-end">
                  <MetricsGlossary open={glossaryOpen} onOpenChange={setGlossaryOpen} compact />
                </div>
                </>
              ) : (
                <EmptyState title="Sin datos ejecutivos" description="Actualice el rango para cargar el resumen." />
              )}
              <DailyReportTab
                canExport={canExport}
                daily={daily}
                dailyDate={dailyDate}
                error={dailyError}
                loading={classicLoading}
                exporting={exportInProgress}
                onDateChange={setDailyDate}
                onExport={() => void runReportExport('daily-excel', () => downloadBackendExport({ date_from: dailyDate, date_to: dailyDate }))}
                onExportPdf={() => void runReportExport('daily-pdf', () => downloadBackendPdf({ date: dailyDate, date_from: dailyDate, date_to: dailyDate }))}
                onSubmit={handleDailySubmit}
              />
            </div>
          </TabsContent>

          <TabsContent value="diario">
            <DailyReportTab
              canExport={canExport}
              daily={daily}
              dailyDate={dailyDate}
              error={dailyError}
              loading={classicLoading}
              exporting={exportInProgress}
              onDateChange={setDailyDate}
              onExport={() => void runReportExport('daily-excel', () => downloadBackendExport({ date_from: dailyDate, date_to: dailyDate }))}
              onExportPdf={() => void runReportExport('daily-pdf', () => downloadBackendPdf({ date: dailyDate, date_from: dailyDate, date_to: dailyDate }))}
              onSubmit={handleDailySubmit}
            />
          </TabsContent>

          <TabsContent value="mensual">
            <MonthlyReportTab
              canExport={canExport}
              error={monthlyError}
              loading={classicLoading}
              month={monthlyMonth}
              monthly={monthly}
              exporting={exportInProgress}
              onExport={() => void runReportExport('monthly-excel', () => downloadBackendExport(monthlyRangeFilters(monthlyMonth, monthly)))}
              onExportPdf={() => void runReportExport('monthly-pdf', () => downloadBackendPdf(monthlyRangeFilters(monthlyMonth, monthly)))}
              onMonthChange={setMonthlyMonth}
              onSubmit={handleMonthlySubmit}
            />
          </TabsContent>

          <TabsContent value="rango">
            <div className="space-y-4">
              {rangeError ? (
                <Alert variant="destructive" title="No se pudo cargar el rango">
                  {rangeError}
                </Alert>
              ) : null}
              <IncomeReportTab
                canExport={canExport}
                dateFrom={dateFrom}
                dateTo={dateTo}
                categoryId={categoryId}
                areaId={areaId}
                cashSessionId={cashSessionId}
                cashierId={cashierId}
                method={method}
                status={status}
                categoryOptions={categoryOptions}
                areaOptions={areaOptions}
                cashSessionOptions={cashSessionOptions}
                loading={classicLoading}
                exporting={exportInProgress}
                income={income}
                categories={categories}
                areas={areas}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onCategoryChange={setCategoryId}
                onAreaChange={setAreaId}
                onCashSessionChange={setCashSessionId}
                onCashierChange={setCashierId}
                onMethodChange={setMethod}
                onExport={() => void runReportExport('range-excel', () => downloadBackendExport(reportFilters()))}
                onExportPdf={() => void runReportExport('range-pdf', () => downloadBackendPdf(reportFilters()))}
                onStatusChange={setStatus}
                onSubmit={loadRangeReports}
              />
            </div>
          </TabsContent>

          <TabsContent value="tendencia">
            {report ? (
              <div className="flex flex-col gap-5">
                <TrendChart report={report} />
                <DailyCashSummary report={report} cashSession={cashSession} />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="metodos">
            {report ? <PaymentMethodPanel report={report} /> : null}
          </TabsContent>

          <TabsContent value="servicios">
            <div className="flex flex-col gap-5">
              {report ? <ServiceRanking report={report} /> : null}
              <ServiceSalesTab
                canExport={canExport}
                dateFrom={dateFrom}
                dateTo={dateTo}
                categories={categories}
                serviceSales={serviceSales}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                exporting={exportInProgress}
                onExport={() => void runReportExport('services-excel', () => downloadBackendExport(reportFilters()))}
                onExportPdf={() => void runReportExport('services-pdf', () => downloadBackendPdf(reportFilters()))}
                onSubmit={loadRangeReports}
              />
            </div>
          </TabsContent>

          <TabsContent value="caja">
            <div className="flex flex-col gap-5">
              {report ? <CashReconciliationPanel report={report} /> : null}
              {canViewCashSessionReport ? (
                <CashSessionReportTab
                  canExport={canExport}
                  cashSession={cashSessionReport}
                  cashReportId={cashReportId}
                  loading={classicLoading}
                  exporting={exportInProgress}
                  error={cashError}
                  onCashReportIdChange={setCashReportId}
                  onExport={() => void runReportExport('cash-excel', () => downloadBackendExport(cashSessionExportFilters(cashReportId, cashSessionReport)))}
                  onSubmit={handleCashSubmit}
                />
              ) : (
                <EmptyState
                  title="Reporte de caja no disponible"
                  description="Este usuario no tiene permiso para consultar cajas."
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cajeros">
            {report ? <CashierTable report={report} /> : null}
          </TabsContent>

          <TabsContent value="pendientes">
            {report ? <PendingAgingPanel report={report} /> : null}
          </TabsContent>

          <TabsContent value="anulaciones">
            {report ? <VoidsReversalsPanel report={report} /> : null}
          </TabsContent>

          <TabsContent value="auditoria">
            <div className="flex flex-col gap-5">
              {report ? <AuditSummaryPanel report={report} /> : null}
              <AuditoriaTab
                canExport={canExport}
                operations={operations}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                exporting={exportInProgress}
                onExport={() => void runReportExport('audit-excel', () => downloadBackendExport(reportFilters()))}
                onExportPdf={() => void runReportExport('audit-pdf', () => downloadBackendPdf(reportFilters()))}
                onSubmit={loadRangeReports}
              />
              <Card>
                <CardContent className="text-xs text-muted-foreground">
                  Eventos de auditoria basados en la pista inmutable (audit_logs). Los conteos reflejan
                  el periodo seleccionado.
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="exportaciones">
            <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
              <CardContent className="flex flex-col gap-3 pt-5">
                <header className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Salidas oficiales
                  </p>
                  <h2 className="text-base font-semibold text-foreground">Exportaciones formales</h2>
                  <p className="text-sm text-muted-foreground">
                    PDF ejecutivo y Excel contable usan los mismos totales del reporte mostrado en pantalla.
                  </p>
                </header>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={!canExport || isFetching || exportInProgress || !report || executiveRangeError !== null}
                    className="rounded border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportingReport === 'executive-pdf' ? 'Exportando PDF...' : 'Exportar PDF ejecutivo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={!canExport || isFetching || exportInProgress || !report || executiveRangeError !== null}
                    className="rounded border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportingReport === 'executive-excel' ? 'Exportando Excel...' : 'Exportar Excel ejecutivo'}
                  </button>
                  <MetricsGlossary open={glossaryOpen} onOpenChange={setGlossaryOpen} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      {!canViewManagerial && !canViewCashSessionReport ? (
        <InfoPanel
          tone="warning"
          title="Sin permisos para reportes"
          description="Su usuario no tiene acceso a la seccion ejecutiva ni a cajas. Solicite a un supervisor la revision de sus permisos."
        />
      ) : null}
    </section>
  );
}

function DailyCashSummary({
  report,
  cashSession,
}: {
  report: ExecutiveReport;
  cashSession: { id: number; opening_amount: string; expected_cash_amount?: string; status: string } | null | undefined;
}) {
  const summary = useMemo(() => {
    const last7 = report.daily_trend.slice(-7);
    const billedWeekCents = last7.reduce((acc, day) => acc + (parseCents(day.billed) ?? 0), 0);
    const collectedWeekCents = last7.reduce((acc, day) => acc + (parseCents(day.collected) ?? 0), 0);
    return { billedWeekCents, collectedWeekCents };
  }, [report]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Lectura semanal
          </p>
          <p className="text-sm font-semibold text-foreground">
            Ultimos 7 dias - {report.daily_trend.length} dias en el rango
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Facturado 7d</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground" translate="no">
              {formatLempirasUIFromCents(summary.billedWeekCents)}
            </p>
          </div>
          <div className="rounded border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cobrado 7d</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground" translate="no">
              {formatLempirasUIFromCents(summary.collectedWeekCents)}
            </p>
          </div>
        </div>
        {cashSession && cashSession.status === 'open' ? (
          <p className="text-xs text-muted-foreground">
            Caja abierta #{cashSession.id} con inicial L {Number(cashSession.opening_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function monthlyRangeFilters(month: string, monthly: MonthlyReport | null): ReportFilters {
  if (monthly?.month === month) {
    return {
      date_from: monthly.date_from,
      date_to: monthly.date_to,
    };
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return {
      date_from: today,
      date_to: today,
    };
  }

  return {
    date_from: `${month}-01`,
    date_to: localDateString(new Date(year, monthNumber, 0)),
  };
}

function sameExecutiveFilters(left: ExecutiveReportFilters, right: ExecutiveReportFilters): boolean {
  return left.date_from === right.date_from && left.date_to === right.date_to;
}
function cashSessionExportFilters(cashReportId: string, cashSession: CashSessionReport | null): ReportFilters {
  const openedDate = cashSessionDate(cashSession?.cash_session.opened_at);
  const closedDate = cashSessionDate(cashSession?.cash_session.closed_at);

  return {
    date_from: openedDate ?? today,
    date_to: closedDate ?? openedDate ?? today,
    cash_session_id: cashReportId || null,
  };
}

function cashSessionDate(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;
}

function validateReportDateRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Seleccione fecha de inicio y fin para el reporte.';
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Seleccione fechas validas para el reporte.';
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (diffDays < 1) {
    return 'La fecha de inicio debe ser anterior o igual a la fecha de fin.';
  }

  if (diffDays > MAX_REPORT_RANGE_DAYS) {
    return 'El rango maximo permitido para reportes es de 31 dias.';
  }

  return null;
}
