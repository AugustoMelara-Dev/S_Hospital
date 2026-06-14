import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { MetricCard } from '../../components/ui/metric-card';
import { PageHeader } from '../../components/ui/page-header';
import { Skeleton } from '../../components/ui/states';
import { type CashSession, type DashboardReport, apiClient, userSafeErrorMessage } from '../../lib/api';
import { formatLempiras } from '../../lib/money';
import { CashierList } from './CashierList';
import { PaymentMethodPieChart } from './PaymentMethodPieChart';
import { RevenueBarChart } from './RevenueBarChart';
import { TopServicesChart } from './TopServicesChart';
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
  canViewCash,
  canViewFiscalSettings,
  canViewManagerialReports,
  cashSession,
  onQuickCash,
  onQuickInvoice,
  onStatus,
}: DashboardViewProps) {
  const [dashboardData, setDashboardData] = useState<DashboardReport | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
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
        const msg = userSafeErrorMessage(err, 'No se pudo cargar el resumen.');
        setDashboardError(msg);
        onStatus(msg);
      })
      .finally(() => {
        setLoadingDashboard(false);
      });
  };

  const fetchSetupStatus = () => {
    if (!canViewFiscalSettings && !canViewManagerialReports) {
      return;
    }

    apiClient.request<SetupStatus>('/api/system/setup-status')
      .then((res: SetupStatus) => {
        setSetupStatus(res);
      })
      .catch(() => {
        setSetupStatus(null);
      });
  };

  useEffect(() => {
    fetchDashboard();
    fetchSetupStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewManagerialReports, canViewFiscalSettings]);

  return (
    <>
      <PageHeader
        title="Inicio"
        description="Lo necesario para operar caja, cobros y facturación sin perderse."
      />

      {setupStatus?.needs_setup && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
                <div>
                  <CardTitle className="text-base font-bold text-warning-foreground">
                    Configuración pendiente
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs text-warning-foreground/80">
                    Complete estos datos para emitir facturas correctamente.
                  </CardDescription>
                </div>
              </div>
              {canViewFiscalSettings && (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  onClick={() => setIsWizardOpen(true)}
                >
                  <Sparkles className="size-3.5" />
                  Revisar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SetupStepCheck
                label="Datos del hospital"
                done={setupStatus.steps.fiscal_settings}
                helper="Nombre y RTN"
              />
              <SetupStepCheck
                label="Usuario administrador"
                done={setupStatus.steps.admin_exists}
                helper="Acceso principal listo"
              />
              <SetupStepCheck
                label="Catálogo"
                done={setupStatus.steps.catalog_has_services}
                helper="Servicios para facturar"
              />
              <SetupStepCheck
                label="Rango fiscal"
                done={setupStatus.steps.fiscal_sequence_exists}
                helper="Numeración vigente"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_0.85fr]" aria-label="Resumen operativo del mes">
          <MetricCard
            icon={<WalletCards className="size-4 text-emerald-600" />}
            label="Caja"
            value={cashSession ? `Caja #${cashSession.id}` : 'Cerrada'}
            helper={cashSession ? 'Lista para cobrar' : 'Abra caja antes de facturar'}
            variant={cashSession ? 'success' : 'warning'}
          />

          <MetricCard
            icon={<TrendingUp className="size-4 text-primary" />}
            label="Facturado"
            value={loadingDashboard ? <Skeleton className="h-7 w-24" /> : formatLempiras(dashboardData?.current_month.total_billed)}
            helper={dashboardData ? `${dashboardData.current_month.invoice_count} facturas este mes` : 'Facturación del mes'}
          />

          <MetricCard
            icon={<CreditCard className="size-4 text-emerald-600" />}
            label="Cobrado"
            value={loadingDashboard ? <Skeleton className="h-7 w-24" /> : formatLempiras(dashboardData?.current_month.total_collected)}
            helper={dashboardData ? `${dashboardData.current_month.payment_count} pagos recibidos` : 'Cobros del mes'}
          />

          <MetricCard
            icon={<ReceiptText className="size-4 text-info" />}
            label="Facturas"
            value={loadingDashboard ? <Skeleton className="h-7 w-16" /> : String(dashboardData?.current_month.invoice_count ?? 0)}
            helper="Emitidas este mes"
            variant="info"
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.9fr)]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Facturación y cobros</CardTitle>
                  <CardDescription>Últimos 7 días.</CardDescription>
                </div>
                {canViewManagerialReports && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={fetchDashboard}>
                    <RefreshCw className={`size-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
                    Actualizar
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
                  <EmptyPanel message="No hay datos disponibles." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Cajeros hoy</CardTitle>
                <CardDescription>Cobros recibidos por usuario.</CardDescription>
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

          <div className="flex flex-col gap-5">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base font-bold">Siguiente acción</CardTitle>
                <CardDescription>Una acción principal según el estado de caja.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!cashSession && canViewCash ? (
                  <Button type="button" onClick={onQuickCash} className="h-10 w-full justify-start gap-2 font-medium">
                    <WalletCards className="size-4 shrink-0" />
                    Abrir caja
                    <ArrowRight className="ml-auto size-4 shrink-0" />
                  </Button>
                ) : canCreateInvoices ? (
                  <Button type="button" onClick={onQuickInvoice} className="h-10 w-full justify-start gap-2 font-medium">
                    <ReceiptText className="size-4 shrink-0" />
                    Nueva factura
                    <ArrowRight className="ml-auto size-4 shrink-0" />
                  </Button>
                ) : (
                  <EmptyPanel message="No hay acciones disponibles para este usuario." compact />
                )}

                <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Red local</p>
                      <p className="mt-0.5">Los cobros y respaldos se guardan en el servidor del hospital.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Cobros de hoy</CardTitle>
                <CardDescription>Distribución por método de pago.</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Servicios principales</CardTitle>
                <CardDescription>Top 5 del mes.</CardDescription>
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

function SetupStepCheck({ label, done, helper }: { label: string; done: boolean; helper: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="size-4 text-warning" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

function PermissionLockedState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Activity className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin permiso para ver este resumen</p>
      <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
        El resto de acciones disponibles para su rol siguen visibles en el menú.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">No se pudo cargar</p>
      <p className="mb-4 mt-1 max-w-[320px] text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

function EmptyPanel({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground ${compact ? 'min-h-20' : 'h-[300px]'}`}>
      {message}
    </div>
  );
}
