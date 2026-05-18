import {
  Activity,
  Archive,
  Boxes,
  ClipboardList,
  FileClock,
  ReceiptText,
  Settings,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { type CashSession, type DailyReport, apiClient } from '../../lib/api';

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
  onStatus: (message: string) => void;
};

const today = localDateString();

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
  onStatus,
}: DashboardViewProps) {
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyError, setDailyError] = useState('');
  const [loadingDaily, setLoadingDaily] = useState(false);

  useEffect(() => {
    if (!canViewManagerialReports) {
      return;
    }

    let active = true;
    setLoadingDaily(true);

    apiClient
      .getDailyReport(today)
      .then((report) => {
        if (!active) {
          return;
        }

        setDailyReport(report);
        setDailyError('');
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : 'No se pudo cargar el resumen diario.';
        setDailyError(message);
        onStatus(message);
      })
      .finally(() => {
        if (active) {
          setLoadingDaily(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewManagerialReports, onStatus]);

  const modules = [
    {
      label: 'Nueva factura',
      description: 'Crear y cobrar una factura desde el POS.',
      enabled: canCreateInvoices,
      href: '/billing/new',
      icon: ReceiptText,
      primary: true,
    },
    {
      label: 'Caja',
      description: cashSession ? `Caja #${cashSession.id} abierta.` : 'Abrir o revisar caja antes de facturar.',
      enabled: canViewCash,
      href: '/cashbox',
      icon: WalletCards,
      primary: !cashSession,
    },
    {
      label: 'Historial',
      description: 'Buscar, reimprimir o revisar facturas emitidas.',
      enabled: canViewInvoices,
      href: '/invoices',
      icon: FileClock,
      primary: false,
    },
    {
      label: 'Catalogo',
      description: 'Servicios, categorias, precios y codigos de escaneo.',
      enabled: canViewCatalog,
      href: '/catalog',
      icon: Boxes,
      primary: false,
    },
    {
      label: 'Reportes',
      description: 'Ingresos, servicios, caja, anulaciones y backups.',
      enabled: canViewReports,
      href: '/reports',
      icon: ClipboardList,
      primary: false,
    },
    {
      label: 'Backups',
      description: 'Respaldos locales para operacion offline LAN.',
      enabled: canViewBackups,
      href: '/backups',
      icon: Archive,
      primary: false,
    },
    {
      label: 'Configuracion fiscal',
      description: 'CAI, rangos, impuesto y datos del hospital.',
      enabled: canViewFiscalSettings,
      href: '/settings/fiscal',
      icon: Settings,
      primary: false,
    },
  ];
  const enabledModules = modules.filter((module) => module.enabled);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Panel operativo para caja hospitalaria local. Prioriza facturacion, caja abierta y estado del dia."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores del dia">
          <MetricCard
            helper={cashSession ? 'Lista para cobrar facturas.' : 'Abrir caja antes de operar POS.'}
            label="Caja activa"
            value={cashSession ? `#${cashSession.id}` : 'Sin caja'}
            variant={cashSession ? 'success' : 'warning'}
          />
          <MetricCard
            helper={canViewManagerialReports ? 'Total emitido segun backend.' : 'Requiere permiso gerencial.'}
            label="Facturado hoy"
            value={dailyReport ? `L. ${dailyReport.total_billed}` : loadingDaily ? 'Cargando...' : 'No disponible'}
          />
          <MetricCard
            helper={canViewManagerialReports ? 'Pagos registrados del dia.' : 'Requiere permiso gerencial.'}
            label="Cobrado hoy"
            value={dailyReport ? `L. ${dailyReport.total_collected}` : loadingDaily ? 'Cargando...' : 'No disponible'}
          />
          <MetricCard
            helper={dailyReport ? `${dailyReport.payment_count} pagos registrados.` : 'Resumen operativo.'}
            label="Facturas hoy"
            value={dailyReport ? String(dailyReport.invoice_count) : loadingDaily ? '...' : 'No disponible'}
          />
        </section>

        <Card className="xl:row-span-2">
          <CardHeader>
            <CardTitle>Acciones de caja</CardTitle>
            <CardDescription>Entradas rapidas segun permisos del usuario.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canCreateInvoices ? (
              <Button asChild>
                <Link to="/billing/new">
                  <ReceiptText className="size-4" aria-hidden="true" />
                  Nueva factura
                </Link>
              </Button>
            ) : null}
            {canViewCash ? (
              <Button asChild variant={cashSession ? 'secondary' : 'default'}>
                <Link to="/cashbox">
                  <WalletCards className="size-4" aria-hidden="true" />
                  {cashSession ? 'Ver caja activa' : 'Abrir caja'}
                </Link>
              </Button>
            ) : null}
            {canViewInvoices ? (
              <Button asChild variant="secondary">
                <Link to="/invoices">
                  <FileClock className="size-4" aria-hidden="true" />
                  Historial y reimpresion
                </Link>
              </Button>
            ) : null}
            {canViewReports ? (
              <Button asChild variant="secondary">
                <Link to="/reports">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Reportes
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2" aria-label="Modulos disponibles">
          {enabledModules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.href}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                        <Icon className="size-5 text-primary" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate">{module.label}</CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">Disponible</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant={module.primary ? 'default' : 'secondary'} size="sm">
                    <Link to={module.href} onClick={() => onStatus(`Abriendo modulo: ${module.label}.`)}>
                      Abrir modulo
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <Activity className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Estado operativo</CardTitle>
                <CardDescription>Senales que importan antes de mostrar el sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusRow label="Caja" ok={Boolean(cashSession)} text={cashSession ? 'Abierta' : 'Pendiente'} />
            <StatusRow label="Reportes" ok={!dailyError} text={dailyError || 'Sin alertas visibles'} />
            <StatusRow label="Modulos" ok={enabledModules.length > 0} text={`${enabledModules.length} disponibles`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MetricCard({
  helper,
  label,
  value,
  variant = 'neutral',
}: {
  helper: string;
  label: string;
  value: string;
  variant?: 'neutral' | 'success' | 'warning';
}) {
  const badge = {
    neutral: 'Operativo',
    success: 'Listo',
    warning: 'Atencion',
  }[variant];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <Badge variant={variant === 'warning' ? 'outline' : 'secondary'}>{badge}</Badge>
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
      <span className="text-sm font-semibold">{label}</span>
      <Badge variant={ok ? 'secondary' : 'outline'}>{text}</Badge>
    </div>
  );
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
