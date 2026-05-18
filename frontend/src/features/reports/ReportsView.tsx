import { type FormEvent, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { PageHeader } from '../../components/ui/page-header';
import { EmptyState } from '../../components/ui/states';
import { DailyReportTab } from './components/DailyReportTab';
import { IncomeReportTab } from './components/IncomeReportTab';
import { ServiceSalesTab } from './components/ServiceSalesTab';
import { AuditoriaTab } from './components/AuditoriaTab';
import { CashSessionReportTab } from './components/CashSessionReportTab';
import {
  type Category,
  type CategoryReport,
  type CashSessionReport,
  type DailyReport,
  type IncomeReport,
  type OperationsReport,
  type ReportFilters,
  type ServiceSalesReport,
  apiClient,
  userSafeErrorMessage,
} from '../../lib/api';

type ReportsViewProps = {
  canExport: boolean;
  canViewCashSessionReport: boolean;
  canViewManagerial: boolean;
  onStatus: (message: string) => void;
};

type ReportTab = 'diario' | 'rango' | 'servicios' | 'auditoria' | 'caja';

const today = localDateString(new Date());

export function ReportsView({
  canExport,
  canViewCashSessionReport,
  canViewManagerial,
  onStatus,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('diario');
  const [dailyDate, setDailyDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [categoryId, setCategoryId] = useState('');
  const [cashSessionId, setCashSessionId] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [method, setMethod] = useState<NonNullable<ReportFilters['method']>>('');
  const [status, setStatus] = useState<NonNullable<ReportFilters['status']>>('');
  const [cashReportId, setCashReportId] = useState('');
  const [dailyError, setDailyError] = useState('');
  const [cashError, setCashError] = useState('');
  const [loading, setLoading] = useState(false);

  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [categories, setCategories] = useState<CategoryReport | null>(null);
  const [serviceSales, setServiceSales] = useState<ServiceSalesReport | null>(null);
  const [operations, setOperations] = useState<OperationsReport | null>(null);
  const [cashSession, setCashSession] = useState<CashSessionReport | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);

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
      const message = userSafeErrorMessage(error, 'No se pudo cargar el reporte diario.');
      setDailyError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      setCategoryOptions(await apiClient.getCategories());
    } catch {
      setCategoryOptions([]);
    }
  }

  async function loadRangeReports() {
    setLoading(true);
    onStatus('Cargando reportes por rango...');

    try {
      const filters = reportFilters();
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
      const message = userSafeErrorMessage(error, 'No se pudieron cargar los reportes.');
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCashReport() {
    if (!cashReportId.trim()) {
      setCashError('Ingrese el número de caja.');
      onStatus('Ingrese el número de caja.');
      return;
    }

    setLoading(true);
    setCashError('');
    onStatus('Cargando resumen de caja...');

    try {
      setCashSession(await apiClient.getCashSessionReport(cashReportId));
      onStatus('Resumen de caja cargado.');
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar la caja.');
      setCashError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  function reportFilters(): ReportFilters {
    return {
      date_from: dateFrom,
      date_to: dateTo,
      category_id: categoryId || null,
      user_id: cashierId || null,
      cash_session_id: cashSessionId || null,
      method: method || null,
      status: status || null,
    };
  }

  function handleDailySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDaily(dailyDate);
  }

  function handleCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCashReport();
  }

  return (
    <section id="reportes" aria-labelledby="reports-title">
      <PageHeader
        title="Reportes"
        description="Gerencia hospitalaria"
        actions={
          <Badge variant={loading ? 'outline' : 'secondary'}>
            {loading ? 'Consultando...' : 'Datos auditables'}
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="diario">Diario</TabsTrigger>
          <TabsTrigger value="rango">Por Rango</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          {canViewCashSessionReport && (
            <TabsTrigger value="caja">Caja</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="diario" className="mt-0">
          {canViewManagerial ? (
            <DailyReportTab
              canExport={canExport}
              daily={daily}
              dailyDate={dailyDate}
              error={dailyError}
              loading={loading}
              onDateChange={setDailyDate}
              onSubmit={handleDailySubmit}
            />
          ) : (
            <EmptyState
              title="Reportes gerenciales no disponibles"
              description="Este usuario no tiene permisos gerenciales."
            />
          )}
        </TabsContent>

        <TabsContent value="rango" className="mt-0">
          {canViewManagerial ? (
            <IncomeReportTab
              canExport={canExport}
              dateFrom={dateFrom}
              dateTo={dateTo}
              categoryId={categoryId}
              cashSessionId={cashSessionId}
              cashierId={cashierId}
              method={method}
              status={status}
              categoryOptions={categoryOptions}
              loading={loading}
              income={income}
              categories={categories}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onCategoryChange={setCategoryId}
              onCashSessionChange={setCashSessionId}
              onCashierChange={setCashierId}
              onMethodChange={setMethod}
              onStatusChange={setStatus}
              onSubmit={loadRangeReports}
            />
          ) : (
            <EmptyState
              title="Reportes gerenciales no disponibles"
              description="Este usuario no tiene permisos gerenciales."
            />
          )}
        </TabsContent>

        <TabsContent value="servicios" className="mt-0">
          {canViewManagerial ? (
            <ServiceSalesTab
              canExport={canExport}
              dateFrom={dateFrom}
              dateTo={dateTo}
              categories={categories}
              serviceSales={serviceSales}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onSubmit={loadRangeReports}
            />
          ) : (
            <EmptyState
              title="Reportes gerenciales no disponibles"
              description="Este usuario no tiene permisos gerenciales."
            />
          )}
        </TabsContent>

        <TabsContent value="auditoria" className="mt-0">
          {canViewManagerial ? (
            <AuditoriaTab
              canExport={canExport}
              operations={operations}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onSubmit={loadRangeReports}
            />
          ) : (
            <EmptyState
              title="Reportes gerenciales no disponibles"
              description="Este usuario no tiene permisos gerenciales."
            />
          )}
        </TabsContent>

        <TabsContent value="caja" className="mt-0">
          {canViewCashSessionReport ? (
            <CashSessionReportTab
              canExport={canExport}
              cashSession={cashSession}
              cashReportId={cashReportId}
              loading={loading}
              error={cashError}
              onCashReportIdChange={setCashReportId}
              onSubmit={handleCashSubmit}
            />
          ) : (
            <EmptyState
              title="Reporte de caja no disponible"
              description="Este usuario no tiene permiso para consultar cajas."
            />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
