import {
  Activity,
  ClipboardList,
  ReceiptText,
  WalletCards,
  TrendingUp,
  CreditCard,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { type ReactNode } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { Skeleton } from '../../components/ui/states';
import { type CashSession, type DashboardReport, apiClient } from '../../lib/api';
import { RevenueBarChart } from './RevenueBarChart';
import { PaymentMethodPieChart } from './PaymentMethodPieChart';
import { TopServicesChart } from './TopServicesChart';
import { CashierList } from './CashierList';
import { SetupWizardDialog } from './components/SetupWizardDialog';

type DashboardViewProps = {
  canCreateInvoices: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewManagerialReports: boolean;
  canViewReports: boolean;
  cashSession: CashSession | null;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
  onStatus: (message: string) => void;
};

type SetupStatus = {
  needs_setup: boolean;
  steps: {
    fiscal_settings: boolean;
    admin_exists: boolean;
    catalog_has_services: boolean;
    fiscal_sequence_exists: boolean;
  };
};

export function DashboardView({
  canCreateInvoices,
  canViewBackups,
  canViewCash,
  canViewCatalog,
  canViewFiscalSettings,
  canViewInvoices,
  canViewManagerialReports,
  canViewReports,
  cashSession,
  onQuickCash,
  onQuickInvoice,
  onStatus,
}: DashboardViewProps) {
  const [dashboardData, setDashboardData] = useState<DashboardReport | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Setup Wizard Banner state
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchDashboard = () => {
    if (!canViewManagerialReports) {
      return;
    }
    setLoadingDashboard(true);
    apiClient
      .getDashboardReport()
      .then((data) => {
        setDashboardData(data);
        setDashboardError('');
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el reporte gerencial.';
        setDashboardError(msg);
        onStatus(msg);
      })
      .finally(() => {
        setLoadingDashboard(false);
      });
  };

  const fetchSetupStatus = () => {
    // Only check setup status for users who can view fiscal settings or are admin/supervisor
    if (!canViewFiscalSettings && !canViewManagerialReports) {
      return;
    }
    setLoadingSetup(true);
    // Call our new public setup-status API endpoint
    apiClient.request<{ needs_setup: boolean; steps: any }>('/api/system/setup-status')
      .then((res: any) => {
        setSetupStatus(res);
      })
      .catch(() => {
        // Silently catch or ignore setup check errors
      })
      .finally(() => {
        setLoadingSetup(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
    fetchSetupStatus();
  }, [canViewManagerialReports, canViewFiscalSettings]);

  const enabledModuleCount = [
    canCreateInvoices,
    canViewBackups,
    canViewCash,
    canViewCatalog,
    canViewFiscalSettings,
    canViewInvoices,
    canViewReports,
  ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Sistema de Facturación Hospitalaria S_Hospital. Panel gerencial y operativo de caja local."
      />

      {/* Onboarding Wizard Checklist Alert for Admin/Supervisor */}
      {setupStatus?.needs_setup && (
        <Card className="border-warning/30 bg-warning/5 dark:bg-warning/10 animate-fade-in mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-warning animate-pulse" />
                <CardTitle className="text-base font-bold text-warning-foreground">
                  Asistente de Configuración Inicial (Pendiente)
                </CardTitle>
              </div>
              {canViewFiscalSettings && (
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white border-0 text-xs font-semibold gap-1.5 h-8 px-3"
                  onClick={() => setIsWizardOpen(true)}
                >
                  <Sparkles className="size-3.5" />
                  Iniciar Asistente
                </Button>
              )}
            </div>
            <CardDescription className="text-xs text-warning-foreground/80 mt-1">
              Para vender y operar legalmente el software en red local, complete los siguientes requisitos iniciales:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <SetupStepCheck
                label="Datos del Hospital"
                done={setupStatus.steps.fiscal_settings}
                helper="Nombre de la institución y RTN"
              />
              <SetupStepCheck
                label="Usuario Administrador"
                done={setupStatus.steps.admin_exists}
                helper="Acceso administrador configurado"
              />
              <SetupStepCheck
                label="Catálogo de Servicios"
                done={setupStatus.steps.catalog_has_services}
                helper="Servicios médicos disponibles"
              />
              <SetupStepCheck
                label="Rango Fiscal (CAI)"
                done={setupStatus.steps.fiscal_sequence_exists}
                helper="Rangos autorizados vigentes"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {/* KPI Cards Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen operativo del mes">
          <MetricCard
            icon={<WalletCards className="size-4 text-emerald-500" />}
            label="Caja operativa"
            value={cashSession ? `Caja #${cashSession.id}` : 'Inactiva'}
            helper={cashSession ? 'Lista para procesar cobros' : 'Debe abrir caja antes de facturar'}
            variant={cashSession ? 'success' : 'warning'}
          />

          <MetricCard
            icon={<TrendingUp className="size-4 text-primary" />}
            label="Facturado (Mes)"
            value={
              loadingDashboard ? (
                <Skeleton className="h-7 w-24" />
              ) : dashboardData ? (
                `L. ${Number(dashboardData.current_month.total_billed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              ) : (
                'L. 0.00'
              )
            }
            helper={
              dashboardData
                ? `${dashboardData.current_month.invoice_count} facturas emitidas este mes`
                : 'Resumen mensual de facturación'
            }
          />

          <MetricCard
            icon={<CreditCard className="size-4 text-emerald-500" />}
            label="Recaudado (Mes)"
            value={
              loadingDashboard ? (
                <Skeleton className="h-7 w-24" />
              ) : dashboardData ? (
                `L. ${Number(dashboardData.current_month.total_collected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              ) : (
                'L. 0.00'
              )
            }
            helper={
              dashboardData
                ? `${dashboardData.current_month.payment_count} transacciones recibidas`
                : 'Recaudaciones acumuladas del mes'
            }
          />

          <MetricCard
            icon={<Activity className="size-4 text-purple-500" />}
            label="Módulos del Sistema"
            value={`${enabledModuleCount} activos`}
            helper="Funciones autorizadas para su rol"
            variant="info"
          />
        </section>

        {/* Dashboard Analytics & Main Layout Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Main Area: Charts and Tables (2 Columns) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Sales vs Collections Trend Chart */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">Tendencia Operativa (Últimos 7 Días)</CardTitle>
                  <CardDescription>Comparativa entre monto facturado y montos cobrados en caja.</CardDescription>
                </div>
                {canViewManagerialReports && (
                  <Button variant="ghost" size="icon" className="size-8" onClick={fetchDashboard}>
                    <RefreshCw className={`size-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-2">
                {!canViewManagerialReports ? (
                  <PermissionLockedState />
                ) : loadingDashboard ? (
                  <div className="flex h-[300px] items-center justify-center">
                    <Skeleton className="h-[280px] w-full" />
                  </div>
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={fetchDashboard} />
                ) : dashboardData ? (
                  <RevenueBarChart data={dashboardData.last_7_days} />
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No hay datos disponibles.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cashiers collection today */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Cierre Operativo de Cajeros (Hoy)</CardTitle>
                <CardDescription>Resumen de cobros por cajero para la fecha actual.</CardDescription>
              </CardHeader>
              <CardContent>
                {!canViewManagerialReports ? (
                  <PermissionLockedState />
                ) : loadingDashboard ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={fetchDashboard} />
                ) : dashboardData ? (
                  <CashierList cashiers={dashboardData.cashiers_summary} />
                ) : null}
              </CardContent>
            </Card>

          </div>

          {/* Sidebar Area: Actions & Right Side Widgets */}
          <div className="flex flex-col gap-6">
            
            {/* Quick Actions Card */}
            <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <CardTitle className="text-base font-bold text-foreground">Acciones rápidas</CardTitle>
                </div>
                <CardDescription>Operaciones rápidas según el estado de la sesión.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!cashSession && canViewCash ? (
                  <Button type="button" onClick={onQuickCash} className="w-full justify-start gap-2 h-10 font-medium">
                    <WalletCards className="size-4 shrink-0" />
                    Abrir Caja Registradora
                    <ArrowRight className="size-4 ml-auto shrink-0" />
                  </Button>
                ) : canCreateInvoices ? (
                  <Button type="button" onClick={onQuickInvoice} className="w-full justify-start gap-2 h-10 font-medium">
                    <ReceiptText className="size-4 shrink-0" />
                    Emitir Nueva Factura
                    <ArrowRight className="size-4 ml-auto shrink-0" />
                  </Button>
                ) : null}

                <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Seguridad Offline LAN</p>
                      <p className="mt-0.5">El sistema corre localmente sin depender de internet. Los respaldos se guardan en el disco duro del servidor.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods Today */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Métodos de Pago (Hoy)</CardTitle>
                <CardDescription>Distribución de cobros realizados hoy.</CardDescription>
              </CardHeader>
              <CardContent>
                {!canViewManagerialReports ? (
                  <PermissionLockedState />
                ) : loadingDashboard ? (
                  <div className="flex h-[240px] items-center justify-center">
                    <Skeleton className="size-40 rounded-full" />
                  </div>
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={fetchDashboard} />
                ) : dashboardData ? (
                  <PaymentMethodPieChart data={dashboardData.payments_by_method} />
                ) : null}
              </CardContent>
            </Card>

            {/* Top services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Servicios Más Vendidos (Mes)</CardTitle>
                <CardDescription>Top 5 de servicios de salud con mayor facturación.</CardDescription>
              </CardHeader>
              <CardContent>
                {!canViewManagerialReports ? (
                  <PermissionLockedState />
                ) : loadingDashboard ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={fetchDashboard} />
                ) : dashboardData ? (
                  <TopServicesChart services={dashboardData.top_services} />
                ) : null}
              </CardContent>
            </Card>

          </div>

        </div>
      </div>

      {canViewFiscalSettings && (
        <SetupWizardDialog
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={() => {
            fetchSetupStatus();
            fetchDashboard();
          }}
        />
      )}
    </>
  );
}

// Helpers

function MetricCard({
  icon,
  helper,
  label,
  value,
  variant = 'neutral',
}: {
  icon: ReactNode;
  helper: string;
  label: string;
  value: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const badgeText = {
    neutral: 'Listo',
    success: 'Abierta',
    warning: 'Atención',
    info: 'Activo',
  }[variant];

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          <Badge variant={variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'secondary'}>
            {badgeText}
          </Badge>
        </div>
        <div className="mt-4 flex flex-col gap-0.5">
          <strong className="text-xl font-bold tracking-tight text-foreground">{value}</strong>
          <span className="text-xs text-muted-foreground">{helper}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupStepCheck({ label, done, helper }: { label: string; done: boolean; helper: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3 shadow-sm">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="size-4 text-emerald-500 fill-emerald-500/20" />
        ) : (
          <Clock className="size-4 text-warning" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{helper}</p>
      </div>
    </div>
  );
}

function PermissionLockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        <Activity className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">Acceso Limitado</p>
      <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
        Su rol no tiene autorización para visualizar gráficos y balances financieros gerenciales.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
        <AlertTriangle className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">Error al cargar datos</p>
      <p className="text-xs text-muted-foreground max-w-[320px] mt-1 mb-4">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-3.5" />
        Reintentar
      </Button>
    </div>
  );
}
